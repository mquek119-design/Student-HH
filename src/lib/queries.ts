import 'server-only';

import { cache } from 'react';

/**
 * The single seam between the UI and the database.
 *
 * There are no fixtures behind this any more. If a house has no plan, no
 * basket or no savings yet, these return empty results and the screens render
 * their empty states. Nothing here invents a number.
 *
 * Server-only: this module reaches for `cookies()`. Pure derivations that a
 * client component needs live in `calc.ts`.
 */

import { basketLineTotal, basketTotal, perPersonTotals } from './calc';
import { findOverlapGaps } from './overlaps';
import {
  toBasketItem,
  toHouse,
  toLedgerEntry,
  toPantryItem,
  toPlannedMeal,
  toRecipe,
  toRecipeIngredient,
  toSubstitution,
  toUser,
} from './mappers';
import { allocateLine, formatPence, splitPence } from './money';
import { isStapleDue } from './staples';
import { currentWeekStart } from './weeks';
import { createClient } from './supabase/server';
import { resolveViewAs } from './viewAs';
import type {
  BasketItem,
  Expense,
  House,
  HouseStaple,
  IngredientCategory,
  Leftover,
  LedgerEntry,
  PantryItem,
  Pence,
  PlanStatus,
  PlannedMeal,
  Recipe,
  ReconciliationItem,
  Savings,
  Split,
  SplitLine,
  SplitStatus,
  Substitution,
  User,
  WeeklyPlan,
} from './types';
import { WEEKDAYS } from './types';

export * from './calc';

/**
 * Throws on a Postgres error so a broken query surfaces instead of rendering
 * empty. Inferring from the whole response (rather than from `data`) keeps the
 * row type intact — Supabase returns a discriminated union, and inferring
 * against `T | null` collapses T to `never`.
 */
function unwrap<R extends { data: unknown; error: { message: string } | null }>(
  result: R,
  context: string
): NonNullable<R['data']> {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  if (result.data === null || result.data === undefined) {
    throw new Error(`${context}: no data returned`);
  }
  return result.data as NonNullable<R['data']>;
}

// ---------------------------------------------------------------------------
// Identity & house
// ---------------------------------------------------------------------------

const ACCENTS = ['green', 'orange', 'blue', 'purple'] as const;

/**
 * The signed-in profile, or null when signed out. Never throws on absence.
 *
 * Creates the profile row if it is missing. The `on_auth_user_created` trigger
 * normally does this, but attaching a trigger to `auth.users` requires table
 * ownership that managed Supabase projects do not grant, so it may not exist.
 * Bootstrapping here keeps sign-in working either way — and the RLS insert
 * policy (`id = auth.uid()`) means a user can only ever create their own.
 */
/**
 * The signed-in account, never impersonated.
 *
 * Only the "viewing as" banner needs this — everything else in the app should
 * go through `getCurrentUser()` so the whole screen agrees on who it is for.
 */
export const getRealUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const existing = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return existing.data ? toUser(existing.data) : null;
});

export const getCurrentUserOrNull = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const existing = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (existing.data) {
    const real = toUser(existing.data);
    // Dev-only, demo-only, same-house-only. RLS still judges every write by the
    // real `auth.uid()` — see viewAs.ts.
    return (await resolveViewAs(real, supabase)) ?? real;
  }

  const fallbackName =
    (user.user_metadata?.name as string | undefined)?.trim() ||
    user.email?.split('@')[0] ||
    'Housemate';

  const created = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      name: fallbackName,
      email: user.email ?? '',
      // Deterministic from the user id so a housemate's colour never changes.
      accent: ACCENTS[[...user.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % ACCENTS.length],
    })
    .select('*')
    .single();

  if (created.data) return toUser(created.data);

  // Lost a race with the trigger (or another tab) — re-read the winner's row.
  const retry = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return retry.data ? toUser(retry.data) : null;
});

export const getCurrentUser = cache(async (): Promise<User> => {
  const user = await getCurrentUserOrNull();
  if (!user) throw new Error('Not signed in');
  return user;
});

/** Null when the user has not created or joined a house yet. */
export const getHouseOrNull = cache(async (): Promise<House | null> => {
  const me = await getCurrentUser();
  if (!me.houseId) return null;

  const supabase = await createClient();
  const { data } = await supabase.from('houses').select('*').eq('id', me.houseId).maybeSingle();
  return data ? toHouse(data) : null;
});

export const getHouse = cache(async (): Promise<House> => {
  const house = await getHouseOrNull();
  if (!house) throw new Error('No house — complete onboarding first');
  return house;
});

export const getHousemates = cache(async (): Promise<User[]> => {
  const me = await getCurrentUser();
  if (!me.houseId) return [];

  const supabase = await createClient();
  const result = await supabase
    .from('profiles')
    .select('*')
    .eq('house_id', me.houseId)
    .order('created_at');
  return unwrap(result, 'getHousemates').map(toUser);
});

/**
 * The housemate who places this week's order. Falls back to the admin, then to
 * the first member, so checkout is never orphaned if the collector leaves.
 */
export const getCollector = cache(async (): Promise<User | null> => {
  const [house, housemates] = await Promise.all([getHouseOrNull(), getHousemates()]);
  if (!house || housemates.length === 0) return null;

  return (
    housemates.find((user) => user.id === house.collectorUserId) ??
    housemates.find((user) => user.isAdmin) ??
    housemates[0]
  );
});

// ---------------------------------------------------------------------------
// Shared lookups
// ---------------------------------------------------------------------------

/**
 * The ingredient catalogue, fetched once per request.
 *
 * Recipes, the pantry and the basket all need it. Each round trip to Supabase
 * costs real latency, so these must not each fetch their own copy.
 */
const getIngredientRows = cache(async () => {
  const supabase = await createClient();
  return unwrap(await supabase.from('ingredients').select('*'), 'ingredients');
});

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

async function loadRecipes(ids?: string[]): Promise<Recipe[]> {
  const supabase = await createClient();

  let query = supabase.from('recipes').select('*').order('title');
  if (ids) {
    if (ids.length === 0) return [];
    query = supabase.from('recipes').select('*').in('id', ids).order('title');
  }

  const recipeRows = unwrap(await query, 'getRecipes');
  if (recipeRows.length === 0) return [];

  const recipeIds = recipeRows.map((row) => row.id);
  const [links, ingredientRows, pantry] = await Promise.all([
    supabase.from('recipe_ingredients').select('*').in('recipe_id', recipeIds),
    getIngredientRows(),
    getPantryItems(),
  ]);

  const linkRows = unwrap(links, 'recipe_ingredients');
  const ingredientById = new Map(ingredientRows.map((row) => [row.id, row]));

  // "In the pantry" means present and not flagged low — a nearly empty bottle
  // of oil should not stop the item being added to the basket.
  const stocked = new Set(
    pantry.filter((item) => !item.lowStock).map((item) => item.ingredientId)
  );

  return recipeRows.map((row) => {
    const mapped = linkRows
      .filter((link) => link.recipe_id === row.id)
      .map((link) => {
        const ingredient = ingredientById.get(link.ingredient_id);
        return ingredient ? toRecipeIngredient(link, ingredient, stocked) : null;
      })
      .filter((value): value is NonNullable<typeof value> => value !== null);

    return toRecipe(row, mapped);
  });
}

export const getRecipes = cache(async (): Promise<Recipe[]> => {
  const me = await getCurrentUser();
  if (!me.houseId) return [];
  return loadRecipes();
});

export async function getRecipe(id: string): Promise<Recipe | null> {
  const [recipe] = await loadRecipes([id]);
  return recipe ?? null;
}

// ---------------------------------------------------------------------------
// Weekly plan
// ---------------------------------------------------------------------------

/** Monday of the current week, as an ISO date. */
/** Next occurrence of the house's cutoff day and time, as an ISO timestamp. */
function nextCutoff(cutoffDay: string, cutoffTime: string): string {
  const dayIndex = WEEKDAYS.indexOf(cutoffDay as (typeof WEEKDAYS)[number]);
  const [hour, minute] = cutoffTime.split(':').map(Number);
  const now = new Date();
  const result = new Date(now);
  result.setHours(hour ?? 17, minute ?? 0, 0, 0);

  const todayIndex = (now.getDay() + 6) % 7;
  let daysAhead = (dayIndex - todayIndex + 7) % 7;
  if (daysAhead === 0 && result <= now) daysAhead = 7;
  result.setDate(result.getDate() + daysAhead);

  return result.toISOString();
}

/** ISO-8601 week number — Thursday of the same week determines the year. */
function isoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

/**
 * A house with no plan row yet gets an in-memory placeholder so the Feed and
 * Plan tabs render their empty states. `id` is empty, which callers use to tell
 * "not created yet" from "created but empty".
 */
function emptyPlan(houseId: string, cutoffDay: string, cutoffTime: string): WeeklyPlan {
  const weekStart = currentWeekStart();
  return {
    id: '',
    houseId,
    weekStartDate: weekStart,
    weekNumber: isoWeekNumber(new Date(weekStart)),
    status: 'planning',
    cutoffAt: nextCutoff(cutoffDay, cutoffTime),
    sharedSavings: 0,
    slot: null,
    meals: [],
    overlaps: [],
    recipes: new Map(),
  };
}

/**
 * One named week, by its Monday.
 *
 * This replaced "the most recent plan row", which was fine while a house could
 * only hold one week and wrong the moment it could hold two: the second the
 * next-week plan existed, the Basket, the Split and the Feed would all have
 * silently followed it and started costing a shop nobody had ordered yet.
 * Every caller now says which week it means.
 */
export const getWeeklyPlanFor = cache(
  async (weekStartDate: string): Promise<WeeklyPlan | null> => {
  const house = await getHouseOrNull();
  if (!house) return null;

  const supabase = await createClient();
  const planResult = await supabase
    .from('weekly_plans')
    .select('*')
    .eq('house_id', house.id)
    .eq('week_start_date', weekStartDate)
    .maybeSingle();

  if (planResult.error) throw new Error(`getWeeklyPlanFor: ${planResult.error.message}`);

  const planRow = planResult.data;
  if (!planRow) {
    return {
      ...emptyPlan(house.id, house.cutoffDay, house.cutoffTime),
      weekStartDate,
    };
  }

  const [mealsResult, housemates] = await Promise.all([
    supabase.from('planned_meals').select('*').eq('plan_id', planRow.id),
    getHousemates(),
  ]);
  const mealRows = unwrap(mealsResult, 'planned_meals');

  const mealIds = mealRows.map((row) => row.id);
  const participantRows =
    mealIds.length === 0
      ? []
      : unwrap(
          await supabase.from('meal_participants').select('*').in('planned_meal_id', mealIds),
          'meal_participants'
        );

  const recipes = await loadRecipes([...new Set(mealRows.map((row) => row.recipe_id))]);
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));

  const meals = mealRows.map((row) =>
    toPlannedMeal(
      row,
      recipeById.get(row.recipe_id)?.title ?? 'Unknown recipe',
      participantRows.filter((participant) => participant.planned_meal_id === row.id)
    )
  );

  const names = Object.fromEntries(housemates.map((user) => [user.id, user.name]));

  return {
    id: planRow.id,
    houseId: planRow.house_id,
    weekStartDate: planRow.week_start_date,
    weekNumber: planRow.week_number,
    status: planRow.status,
    cutoffAt: planRow.cutoff_at,
    sharedSavings: planRow.shared_savings,
    slot:
      planRow.slot_id && planRow.slot_charge !== null
        ? {
            id: planRow.slot_id,
            method: planRow.slot_method ?? 'delivery',
            startsAt: planRow.slot_starts_at,
            endsAt: planRow.slot_ends_at,
            charge: planRow.slot_charge,
          }
        : null,
    meals,
    overlaps: findOverlapGaps(meals, recipes, names),
    recipes: recipeById,
  };
  }
);

/** The week the house is eating. What the Basket, Split and Feed all mean. */
export const getWeeklyPlan = cache(
  async (): Promise<WeeklyPlan | null> => getWeeklyPlanFor(currentWeekStart())
);

/**
 * One meal, with the state of the plan it belongs to.
 *
 * Every meal-scoped action used to validate against `getWeeklyPlan()`, which
 * silently meant "this week" — so the moment a next-week plan existed, joining
 * or leaving anything in it would have been rejected as "not in this week".
 * Scoped to the caller's house, so a meal id from elsewhere resolves to null.
 */
export const getMealContext = cache(
  async (
    mealId: string
  ): Promise<{
    meal: PlannedMeal;
    planId: string;
    planStatus: PlanStatus;
    /** The plan's own Monday, so callers can date the meal's day without
     *  assuming which week it belongs to. */
    weekStartDate: string;
  } | null> => {
    const house = await getHouseOrNull();
    if (!house) return null;

    const supabase = await createClient();
    const mealRow = await supabase
      .from('planned_meals')
      .select('*')
      .eq('id', mealId)
      .maybeSingle();

    if (mealRow.error || !mealRow.data) return null;

    const planRow = await supabase
      .from('weekly_plans')
      .select('id, status, house_id, week_start_date')
      .eq('id', mealRow.data.plan_id)
      .maybeSingle();

    if (planRow.error || !planRow.data) return null;
    if (planRow.data.house_id !== house.id) return null;

    const participants = unwrap(
      await supabase.from('meal_participants').select('*').eq('planned_meal_id', mealId),
      'meal_participants'
    );

    const recipes = await loadRecipes([mealRow.data.recipe_id]);

    return {
      meal: toPlannedMeal(mealRow.data, recipes[0]?.title ?? 'Unknown recipe', participants),
      planId: planRow.data.id,
      planStatus: planRow.data.status,
      weekStartDate: planRow.data.week_start_date,
    };
  }
);

// ---------------------------------------------------------------------------
// Basket
// ---------------------------------------------------------------------------

export const getBasketItems = cache(async (): Promise<BasketItem[]> => {
  const plan = await getWeeklyPlan();
  if (!plan || !plan.id) return [];

  const supabase = await createClient();
  const itemRows = unwrap(
    await supabase.from('basket_items').select('*').eq('plan_id', plan.id).order('category'),
    'getBasketItems'
  );
  if (itemRows.length === 0) return [];

  const allocationRows = unwrap(
    await supabase
      .from('basket_allocations')
      .select('*')
      .in('basket_item_id', itemRows.map((row) => row.id)),
    'basket_allocations'
  );

  // An ingredient with no recorded pack price cannot be costed or split. Flag
  // it so the UI can ask, rather than presenting £0.00 as though it were real.
  const ingredientIds = itemRows
    .map((row) => row.ingredient_id)
    .filter((id): id is string => id !== null);

  const unpriced = new Set<string>();
  if (ingredientIds.length > 0) {
    for (const row of await getIngredientRows()) {
      if (row.pack_price === null) unpriced.add(row.id);
    }
  }

  return itemRows.map((row) =>
    toBasketItem(
      row,
      allocationRows.filter((allocation) => allocation.basket_item_id === row.id),
      // `unit_price === 0` is the real test. Nothing in a supermarket is free,
      // so a zero here means the line could not be priced — and that used to
      // slip through whenever the *ingredient* had a price but the line could
      // not use it (a counted recipe against a weighed pack). Twelve items
      // rendered as £0.00 and were silently missing from the total.
      row.unit_price === 0 || (row.ingredient_id !== null && unpriced.has(row.ingredient_id))
    )
  );
});

// ---------------------------------------------------------------------------
// Settlement
// ---------------------------------------------------------------------------

const CATEGORY_LINES: { category: IngredientCategory; label: string; icon: string }[] = [
  { category: 'fresh', label: 'Fresh', icon: 'eco' },
  { category: 'cupboard', label: 'Cupboard', icon: 'inventory_2' },
  { category: 'frozen', label: 'Frozen', icon: 'ac_unit' },
  { category: 'household', label: 'Household & Staples', icon: 'inventory_2' },
];

/**
 * What the signed-in user owes the collector this week, derived from the actual
 * basket. Every figure traces to a basket line — the `workings` printed on the
 * Split page are the real arithmetic, not a narrative.
 *
 * Returns null when there is no basket to split.
 */
/**
 * How one basket line arrived at your share of it, in words you can check.
 *
 * Three cases, and they must stay distinguishable — this used to print
 * "(yours)" for every allocated line, so a fifth of a chicken pack and a whole
 * pack of stir fry strips you alone were paying for looked identical. There was
 * no way to tell £6.40 meant "all of it" from "your bit of something bigger",
 * which is the one thing the workings exist to say.
 *
 * Allocations are relative weights rather than fractions, so your portion is
 * your weight over the total weight. The percentage is descriptive: the pence
 * beside it come from `splitPence`, which is exact, so a third rendering as
 * 33.3% three times is a rounded label on arithmetic that still adds up.
 */
function shareWorking(
  item: BasketItem,
  lineTotal: Pence,
  userId: string,
  houseSize: number
): string {
  // Nobody in particular: the whole house carries it equally.
  if (item.allocatedTo.length === 0) {
    return `${formatPence(lineTotal)} ÷ ${houseSize}`;
  }

  // Summed rather than found: `allocateLine` adds up repeated userIds, so a
  // housemate allocated twice on one line has both weights counted there and
  // must have both counted here, or the label undersells the figure beside it.
  const totalWeight = item.allocatedTo.reduce((sum, allocation) => sum + allocation.share, 0);
  const myWeight = item.allocatedTo.reduce(
    (sum, allocation) => (allocation.userId === userId ? sum + allocation.share : sum),
    0
  );

  if (totalWeight <= 0 || myWeight >= totalWeight) {
    return `${formatPence(lineTotal)} — all yours`;
  }

  const percent = (myWeight / totalWeight) * 100;
  // One decimal, and only when it earns its place.
  const rendered = Number.isInteger(percent) ? percent.toString() : percent.toFixed(1);
  return `${formatPence(lineTotal)} × ${rendered}%`;
}

export const getCurrentSplit = cache(async (): Promise<Split | null> => {
  const [plan, items, housemates, me, collector] = await Promise.all([
    getWeeklyPlan(),
    getBasketItems(),
    getHousemates(),
    getCurrentUser(),
    getCollector(),
  ]);

  if (!plan || !plan.id || items.length === 0 || !collector || collector.id === me.id) {
    return null;
  }

  const supabase = await createClient();

  const allUserIds = housemates.map((user) => user.id);
  const totals = perPersonTotals(items, allUserIds);
  const myTotal = totals[me.id] ?? 0;
  if (myTotal === 0) return null;

  const lines: SplitLine[] = [];

  for (const { category, label, icon } of CATEGORY_LINES) {
    const categoryItems = items.filter((item) => item.category === category);
    if (categoryItems.length === 0) continue;

    let lineAmount: Pence = 0;
    const workings: { label: string; value: string }[] = [];

    for (const item of categoryItems) {
      const lineTotal = basketLineTotal(item);
      const share = allocateLine(lineTotal, item.allocatedTo, allUserIds)[me.id] ?? 0;
      if (share === 0) continue;
      lineAmount += share;

      workings.push({
        label: `${item.name} (${shareWorking(item, lineTotal, me.id, allUserIds.length)})`,
        value: formatPence(share),
      });
    }

    if (lineAmount === 0) continue;

    lines.push({
      label,
      // "of your items", because this counts the lines you have a share in and
      // not the lines in the category — the bare number read as the latter.
      detail: `${workings.length} of your item${workings.length === 1 ? '' : 's'}`,
      amount: lineAmount,
      icon,
      workings,
    });
  }

  // The delivery or collection charge is a real cost of the shop, so it belongs
  // in the split. Nobody "ordered" it, so it divides equally across the house —
  // splitPence keeps that penny-exact rather than letting rounding vanish.
  let slotShare = 0;
  if (plan.slot && plan.slot.charge > 0 && allUserIds.length > 0) {
    const shares = splitPence(
      plan.slot.charge,
      allUserIds.map(() => 1)
    );
    slotShare = shares[allUserIds.indexOf(me.id)] ?? 0;

    if (slotShare > 0) {
      lines.push({
        label: plan.slot.method === 'collect' ? 'Collection Charge' : 'Delivery Charge',
        detail: plan.slot.startsAt
          ? new Date(plan.slot.startsAt).toLocaleString('en-GB', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })
          : 'Booked slot',
        amount: slotShare,
        icon: 'local_shipping',
        workings: [
          {
            label: `${formatPence(plan.slot.charge)} ÷ ${allUserIds.length}`,
            value: formatPence(slotShare),
          },
        ],
      });
    }
  }

  // Prefer the posted row. Its id is what "I've Paid" updates and its status is
  // the shared truth; without one this is a live preview of what will be owed,
  // which is exactly what the week looks like before the order goes in.
  const postedRow = await supabase
    .from('splits')
    .select('*')
    .eq('plan_id', plan.id)
    .eq('from_user_id', me.id)
    .maybeSingle();

  const posted = postedRow.error ? null : postedRow.data;

  return {
    id: posted?.id ?? `${plan.id}:${me.id}`,
    planId: plan.id,
    fromUserId: me.id,
    toUserId: collector.id,
    // The posted amount is the agreed one. A live recomputation drifting away
    // from what everybody saw when they paid is how a split loses trust.
    amount: posted?.amount ?? myTotal + slotShare,
    status: posted?.status ?? 'pending',
    isPosted: posted !== null,
    lines,
  };
});

/**
 * This week's posted debts, for the collector's view.
 *
 * Empty until someone posts the split — which is the honest answer, since
 * before that nobody owes anything, they merely will.
 */
export const getPostedSplits = cache(
  async (): Promise<{ user: User; amount: Pence; status: SplitStatus; splitId: string }[]> => {
    const [plan, housemates] = await Promise.all([getWeeklyPlan(), getHousemates()]);
    if (!plan?.id) return [];

    const supabase = await createClient();
    const rows = await supabase.from('splits').select('*').eq('plan_id', plan.id);
    if (rows.error) return [];

    const byId = new Map(housemates.map((user) => [user.id, user]));

    return (rows.data ?? [])
      .map((row) => {
        const user = byId.get(row.from_user_id);
        return user
          ? { user, amount: row.amount, status: row.status, splitId: row.id }
          : null;
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => a.user.name.localeCompare(b.user.name));
  }
);

export const getLedger = cache(async (): Promise<LedgerEntry[]> => {
  const house = await getHouseOrNull();
  if (!house) return [];

  const supabase = await createClient();
  const plans = unwrap(
    await supabase.from('weekly_plans').select('id, week_number').eq('house_id', house.id),
    'ledger plans'
  );
  if (plans.length === 0) return [];

  const weekByPlan = new Map(plans.map((plan) => [plan.id, plan.week_number]));
  const splitRows = unwrap(
    await supabase
      .from('splits')
      .select('*')
      .in('plan_id', [...weekByPlan.keys()])
      .order('created_at', { ascending: false }),
    'getLedger'
  );

  const fromSplits = splitRows.map((row) =>
    toLedgerEntry(row, weekByPlan.get(row.plan_id) ?? 0)
  );

  // One-off purchases join the same ledger, one entry per person who owes a
  // share. The payer's own share is not a debt to themselves and is skipped —
  // including it would inflate every balance by the payer's own spending.
  const expenses = await getExpenses();
  const fromExpenses: LedgerEntry[] = expenses.flatMap((expense) =>
    expense.shares
      .filter((share) => share.userId !== expense.paidByUserId && share.amount > 0)
      .map((share) => ({
        id: `${expense.id}:${share.userId}`,
        houseId: expense.houseId,
        // Not part of a weekly plan, so it has no week number. 0 sorts it
        // outside the weekly grouping rather than pretending it belongs to one.
        weekNumber: 0,
        date: expense.spentOn,
        fromUserId: share.userId,
        toUserId: expense.paidByUserId,
        amount: share.amount,
        status: share.settled ? ('confirmed' as const) : ('pending' as const),
        note: expense.description,
        source: 'expense' as const,
      }))
  );

  return [...fromSplits, ...fromExpenses].sort((a, b) => b.date.localeCompare(a.date));
});

/**
 * One-off purchases made outside the weekly shop.
 *
 * Empty rather than throwing when 0014 has not been applied — the Split tab
 * loses a panel instead of the whole page.
 */
export const getExpenses = cache(async (): Promise<Expense[]> => {
  const me = await getCurrentUserOrNull();
  if (!me?.houseId) return [];

  const supabase = await createClient();
  const expenses = await supabase
    .from('expenses')
    .select('*')
    .eq('house_id', me.houseId)
    .order('spent_on', { ascending: false });

  if (expenses.error) {
    if (expenses.error.code === 'PGRST205' || expenses.error.code === '42P01') return [];
    throw new Error(`getExpenses: ${expenses.error.message}`);
  }
  if ((expenses.data ?? []).length === 0) return [];

  const shares = unwrap(
    await supabase
      .from('expense_shares')
      .select('*')
      .in('expense_id', expenses.data.map((row) => row.id)),
    'expense_shares'
  );

  return expenses.data.map((row) => ({
    id: row.id,
    houseId: row.house_id,
    paidByUserId: row.paid_by_user_id,
    description: row.description,
    amount: row.amount,
    spentOn: row.spent_on,
    note: row.note,
    shares: shares
      .filter((share) => share.expense_id === row.id)
      .map((share) => ({
        userId: share.user_id,
        amount: share.amount,
        settled: share.settled,
      })),
  }));
});

export const getPaymentStatus = cache(async (): Promise<{ user: User; paid: boolean }[]> => {
  const [housemates, ledger] = await Promise.all([getHousemates(), getLedger()]);
  if (housemates.length === 0 || ledger.length === 0) return [];

  // Most recent settled week only — older debts live in Balances.
  const latestWeek = Math.max(...ledger.map((entry) => entry.weekNumber));
  const thisWeek = ledger.filter((entry) => entry.weekNumber === latestWeek);

  return housemates.map((user) => {
    const owed = thisWeek.find((entry) => entry.fromUserId === user.id);
    // No entry means nothing to pay, which reads as settled.
    return { user, paid: owed ? owed.status === 'confirmed' : true };
  });
});

// ---------------------------------------------------------------------------
// Pantry
// ---------------------------------------------------------------------------

export const getPantryItems = cache(async (): Promise<PantryItem[]> => {
  const me = await getCurrentUserOrNull();
  if (!me?.houseId) return [];

  const supabase = await createClient();
  const [itemsResult, ingredientRows] = await Promise.all([
    supabase.from('pantry_items').select('*').eq('house_id', me.houseId),
    getIngredientRows(),
  ]);

  const itemRows = unwrap(itemsResult, 'getPantryItems');
  const ingredientById = new Map(ingredientRows.map((row) => [row.id, row]));

  return itemRows
    .map((row) => {
      const ingredient = ingredientById.get(row.ingredient_id);
      return ingredient ? toPantryItem(row, ingredient) : null;
    })
    .filter((value): value is PantryItem => value !== null);
});

/**
 * The house's standing list of non-food essentials.
 *
 * Returns them all, each flagged with whether it is due, so the settings page
 * and the basket build agree by construction rather than by both remembering
 * to apply the same rule.
 *
 * Empty (rather than throwing) when 0013 has not been applied — the feature
 * simply does not appear yet, which beats a crash on the settings page.
 */
export const getHouseStaples = cache(async (): Promise<HouseStaple[]> => {
  const me = await getCurrentUserOrNull();
  if (!me?.houseId) return [];

  const supabase = await createClient();
  const [result, ingredientRows] = await Promise.all([
    supabase.from('house_staples').select('*').eq('house_id', me.houseId),
    getIngredientRows(),
  ]);

  if (result.error) {
    if (result.error.code === 'PGRST205' || result.error.code === '42P01') return [];
    throw new Error(`getHouseStaples: ${result.error.message}`);
  }

  const ingredientById = new Map(ingredientRows.map((row) => [row.id, row]));

  return (result.data ?? [])
    .map((row) => {
      const ingredient = ingredientById.get(row.ingredient_id);
      if (!ingredient) return null;
      return {
        id: row.id,
        ingredientId: row.ingredient_id,
        name: ingredient.name,
        frequency: row.frequency,
        lastAddedOn: row.last_added_on,
        due: isStapleDue(row.frequency, row.last_added_on),
      };
    })
    .filter((value): value is HouseStaple => value !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
});

/**
 * The leftovers board.
 *
 * Carries no cost and never touches the split — the food was paid for by
 * whoever cooked it and offering it round is a gift. Past-date entries are
 * still returned, flagged with a negative `daysLeft`, because a fish pie from
 * Tuesday quietly disappearing is how a board like this loses its credibility.
 */
export const getLeftovers = cache(async (): Promise<Leftover[]> => {
  const me = await getCurrentUserOrNull();
  if (!me?.houseId) return [];

  const supabase = await createClient();
  const result = await supabase
    .from('leftovers')
    .select('*')
    .eq('house_id', me.houseId)
    .order('eat_by');

  if (result.error) {
    if (result.error.code === 'PGRST205' || result.error.code === '42P01') return [];
    throw new Error(`getLeftovers: ${result.error.message}`);
  }

  const today = new Date();
  const midnight = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  return (result.data ?? []).map((row) => ({
    id: row.id,
    houseId: row.house_id,
    createdBy: row.created_by,
    description: row.description,
    portions: row.portions,
    madeOn: row.made_on,
    eatBy: row.eat_by,
    daysLeft: Math.round(
      (new Date(`${row.eat_by}T00:00:00Z`).getTime() - midnight) / 86_400_000
    ),
  }));
});

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

export const getSubstitutions = cache(async (): Promise<Substitution[]> => {
  const items = await getBasketItems();
  if (items.length === 0) return [];

  const supabase = await createClient();
  const rows = unwrap(
    await supabase
      .from('substitutions')
      .select('*')
      .in('basket_item_id', items.map((item) => item.id)),
    'getSubstitutions'
  );
  return rows.map(toSubstitution);
});

export const getReconciliationItems = cache(async (): Promise<ReconciliationItem[]> => {
  const items = await getBasketItems();
  if (items.length === 0) return [];

  const supabase = await createClient();
  const receipts = unwrap(
    await supabase
      .from('delivery_receipts')
      .select('*')
      .in('basket_item_id', items.map((item) => item.id)),
    'delivery_receipts'
  );
  const receiptByItem = new Map(receipts.map((row) => [row.basket_item_id, row]));

  return items.map((item) => {
    const receipt = receiptByItem.get(item.id);
    return {
      basketItemId: item.id,
      name: item.name,
      expectedQuantity: item.quantity,
      // No receipt yet means "assume it all turned up" — the collector corrects.
      receivedQuantity: receipt?.received_quantity ?? item.quantity,
      price: item.unitPrice,
      received: receipt?.received ?? true,
    };
  });
});

// ---------------------------------------------------------------------------
// Savings
// ---------------------------------------------------------------------------

/**
 * Savings we can actually evidence: the difference between what a branded item
 * would have cost and what the own-brand swap cost, summed over real baskets.
 *
 * There is deliberately no "bulk buying" or "pantry reuse" figure and no
 * comparison against other households. Attributing those needs the optimiser to
 * record why each choice was made, and we have no data on other houses at all.
 * A number we cannot derive does not get displayed.
 */
export const getSavings = cache(async (): Promise<Savings> => {
  const house = await getHouseOrNull();
  if (!house) return { totalAllTime: 0, thisWeek: 0, ownBrandSwaps: [] };

  const supabase = await createClient();
  const plans = unwrap(
    await supabase
      .from('weekly_plans')
      .select('id, week_number')
      .eq('house_id', house.id)
      .order('week_start_date', { ascending: false }),
    'savings plans'
  );
  if (plans.length === 0) return { totalAllTime: 0, thisWeek: 0, ownBrandSwaps: [] };

  const rows = unwrap(
    await supabase
      .from('basket_items')
      .select('*')
      .in('plan_id', plans.map((plan) => plan.id))
      .not('original_unit_price', 'is', null),
    'savings basket items'
  );

  const latestPlanId = plans[0]?.id;
  let totalAllTime = 0;
  let thisWeek = 0;
  const ownBrandSwaps: { label: string; amount: Pence }[] = [];

  for (const row of rows) {
    if (row.original_unit_price === null) continue;
    const saved = (row.original_unit_price - row.unit_price) * row.quantity;
    if (saved <= 0) continue;

    totalAllTime += saved;
    if (row.plan_id === latestPlanId) {
      thisWeek += saved;
      ownBrandSwaps.push({ label: `Own-brand swap: ${row.name}`, amount: saved });
    }
  }

  ownBrandSwaps.sort((a, b) => b.amount - a.amount);
  return { totalAllTime, thisWeek, ownBrandSwaps };
});

/** Total value of the current basket — used by the reconciliation baseline. */
export async function getPlannedBasketTotal(): Promise<Pence> {
  return basketTotal(await getBasketItems());
}
