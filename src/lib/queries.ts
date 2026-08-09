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
import { detectConflicts } from './conflicts';
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
import { allocateLine, formatPence } from './money';
import { createClient } from './supabase/server';
import type {
  BasketItem,
  House,
  IngredientCategory,
  LedgerEntry,
  PantryItem,
  Pence,
  Recipe,
  ReconciliationItem,
  Savings,
  Split,
  SplitLine,
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
export const getCurrentUserOrNull = cache(async (): Promise<User | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const existing = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (existing.data) return toUser(existing.data);

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

  const supabase = createClient();
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

  const supabase = createClient();
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
  const supabase = createClient();
  return unwrap(await supabase.from('ingredients').select('*'), 'ingredients');
});

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

async function loadRecipes(ids?: string[]): Promise<Recipe[]> {
  const supabase = createClient();

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
function currentWeekStart(): string {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

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
    meals: [],
    conflicts: [],
  };
}

export const getWeeklyPlan = cache(async (): Promise<WeeklyPlan | null> => {
  const house = await getHouseOrNull();
  if (!house) return null;

  const supabase = createClient();
  const planResult = await supabase
    .from('weekly_plans')
    .select('*')
    .eq('house_id', house.id)
    .order('week_start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (planResult.error) throw new Error(`getWeeklyPlan: ${planResult.error.message}`);

  const planRow = planResult.data;
  if (!planRow) return emptyPlan(house.id, house.cutoffDay, house.cutoffTime);

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
    meals,
    conflicts: detectConflicts(meals, recipes, names),
  };
});

// ---------------------------------------------------------------------------
// Basket
// ---------------------------------------------------------------------------

export const getBasketItems = cache(async (): Promise<BasketItem[]> => {
  const plan = await getWeeklyPlan();
  if (!plan || !plan.id) return [];

  const supabase = createClient();
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
      row.ingredient_id !== null && unpriced.has(row.ingredient_id)
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
      const share = allocateLine(basketLineTotal(item), item.allocatedTo, allUserIds)[me.id] ?? 0;
      if (share === 0) continue;
      lineAmount += share;

      const isShared = item.allocatedTo.length === 0;
      workings.push({
        label: isShared
          ? `${item.name} (${formatPence(basketLineTotal(item))} ÷ ${allUserIds.length})`
          : `${item.name} (yours)`,
        value: formatPence(share),
      });
    }

    if (lineAmount === 0) continue;

    lines.push({
      label,
      detail: `${workings.length} item${workings.length === 1 ? '' : 's'}`,
      amount: lineAmount,
      icon,
      workings,
    });
  }

  return {
    id: `${plan.id}:${me.id}`,
    planId: plan.id,
    fromUserId: me.id,
    toUserId: collector.id,
    amount: myTotal,
    status: 'pending',
    lines,
  };
});

export const getLedger = cache(async (): Promise<LedgerEntry[]> => {
  const house = await getHouseOrNull();
  if (!house) return [];

  const supabase = createClient();
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

  return splitRows.map((row) => toLedgerEntry(row, weekByPlan.get(row.plan_id) ?? 0));
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

  const supabase = createClient();
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

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

export const getSubstitutions = cache(async (): Promise<Substitution[]> => {
  const items = await getBasketItems();
  if (items.length === 0) return [];

  const supabase = createClient();
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

  const supabase = createClient();
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

  const supabase = createClient();
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
