'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canonicalName, findOrCreateIngredient } from '@/lib/ingredients';
import { splitPence } from '@/lib/money';
import { WEEKDAYS } from '@/lib/types';
import { currentWeekStart, isoWeekNumber } from '@/lib/weeks';
import { getCurrentUser } from '@/lib/queries';
import {
  DEMO_HOUSEMATES,
  DEMO_RECIPES,
  DEMO_SCHEDULE,
  DEMO_PANTRY,
  DEMO_STAPLES,
  DEMO_LEFTOVERS,
  DEMO_EXPENSES,
} from '@/lib/demoData';

export interface SeedResult {
  status: 'success' | 'error';
  message: string;
}

const fail = (message: string): SeedResult => ({ status: 'error', message });

/**
 * Wipes this house back to an empty shell.
 *
 * Deletes every weekly plan (which cascades to meals, participants, basket
 * items, allocations, splits, substitutions and delivery receipts), the pantry,
 * every house recipe, and the demo housemates.
 *
 * Two things are deliberately kept:
 *
 *   * `ingredients` — a global catalogue that also caches the resolved Tesco
 *     product, price and image per ingredient. Clearing it would throw away
 *     dozens of live lookups to save nothing; the next seed reuses them.
 *   * Real housemates and the house itself — this clears demo data, not the
 *     house. Leaving is a separate, deliberate action.
 */
export async function clearDemoData(): Promise<SeedResult> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const supabase = await createClient();

  // Plans first: recipes are referenced by planned_meals with ON DELETE
  // RESTRICT, so deleting recipes while a plan still points at them fails.
  const plans = await supabase.from('weekly_plans').delete().eq('house_id', me.houseId).select('id');
  if (plans.error) return fail(`Could not clear plans: ${plans.error.message}`);

  const pantry = await supabase.from('pantry_items').delete().eq('house_id', me.houseId).select('id');
  if (pantry.error) return fail(`Could not clear the pantry: ${pantry.error.message}`);

  const recipes = await supabase.from('recipes').delete().eq('house_id', me.houseId).select('id');
  if (recipes.error) return fail(`Could not clear recipes: ${recipes.error.message}`);

  // Tolerated rather than required: houses that have not run 0013 yet simply
  // have no staples table, and that must not block clearing everything else.
  const staples = await supabase.from('house_staples').delete().eq('house_id', me.houseId).select('id');
  if (staples.error && staples.error.code !== 'PGRST205' && staples.error.code !== '42P01') {
    return fail(`Could not clear staples: ${staples.error.message}`);
  }

  for (const table of ['leftovers', 'expenses'] as const) {
    const wiped = await supabase.from(table).delete().eq('house_id', me.houseId).select('id');
    if (wiped.error && wiped.error.code !== 'PGRST205' && wiped.error.code !== '42P01') {
      return fail(`Could not clear ${table}: ${wiped.error.message}`);
    }
  }

  const removed = await supabase.rpc('remove_demo_housemates');
  if (removed.error) return fail(`Could not remove demo housemates: ${removed.error.message}`);

  revalidatePath('/', 'layout');

  return {
    status: 'success',
    message:
      `Cleared ${plans.data?.length ?? 0} plan(s), ${recipes.data?.length ?? 0} recipe(s), ` +
      `${pantry.data?.length ?? 0} pantry item(s) and ${removed.data ?? 0} demo housemate(s). ` +
      'Ingredient/price cache kept.',
  };
}

/**
 * Fills the house with a full demonstration week.
 *
 * Clears first, always. Seeding on top of existing rows was how the old seeder
 * ended up with two overlapping plans for the same week and meals nobody could
 * account for; a demo you cannot reason about demonstrates nothing.
 *
 * What it does NOT write: basket lines, prices or savings. The basket is the
 * optimiser's output from real Tesco product data, and a hand-written basket
 * row is an invented price sitting in the same table the split reads from.
 * Seed the week, then press Build Basket.
 */
export async function seedDemoData(): Promise<SeedResult> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const cleared = await clearDemoData();
  if (cleared.status === 'error') return cleared;

  const supabase = await createClient();

  // ---------------------------------------------------------------------
  // 1. Housemates — four demo profiles, five people counting the caller.
  // ---------------------------------------------------------------------
  const seeded = await supabase.rpc('seed_demo_housemates', {
    p_names: DEMO_HOUSEMATES,
  });

  if (seeded.error) {
    return fail(
      `Could not add demo housemates: ${seeded.error.message}${
        seeded.error.code === 'PGRST202'
          ? ' — run supabase/migrations/0008_demo_housemates.sql.'
          : ''
      }`
    );
  }

  const profiles = await supabase
    .from('profiles')
    .select('id, name')
    .eq('house_id', me.houseId);

  if (profiles.error) return fail(profiles.error.message);

  // Names are the seed's handle on people: the schedule says "Maya", and only
  // this map knows which uuid that is. The caller answers to "me".
  const idByName = new Map<string, string>([['me', me.id]]);
  for (const row of profiles.data ?? []) {
    idByName.set(row.name.toLowerCase(), row.id);
  }
  const everyone = (profiles.data ?? []).map((row) => row.id);

  // ---------------------------------------------------------------------
  // 2. Recipes. Breakfast, lunch and dinner, with ingredients that recur
  //    across them on purpose — the optimiser has nothing to pool otherwise.
  // ---------------------------------------------------------------------
  const recipeIdByTitle = new Map<string, string>();
  let recipesAdded = 0;

  for (const recipe of DEMO_RECIPES) {
    const ingredientIds: string[] = [];

    for (const ing of recipe.ingredients) {
      const resolved = await findOrCreateIngredient(supabase, {
        name: ing.name,
        unit: ing.unit,
        category: ing.category,
      });
      if ('error' in resolved) return fail(`Ingredient "${ing.name}": ${resolved.error}`);
      ingredientIds.push(resolved.id);
    }

    const created = await supabase
      .from('recipes')
      .insert({
        house_id: me.houseId,
        created_by: me.id,
        title: recipe.title,
        cook_time_mins: recipe.cookTimeMins,
        difficulty: recipe.difficulty,
        servings: recipe.servings,
        // Deliberately 0. Cost per portion is derived from real Tesco pack
        // prices once the basket is built; a hand-typed figure here would be a
        // fabricated price in the same column the app treats as real.
        cost_per_portion: 0,
        tags: recipe.tags,
        instructions: recipe.instructions,
      })
      .select('id')
      .single();

    if (created.error) return fail(`Recipe "${recipe.title}": ${created.error.message}`);

    const links = recipe.ingredients.map((ing, index) => ({
      recipe_id: created.data.id,
      ingredient_id: ingredientIds[index],
      quantity: ing.quantity,
      unit: ing.unit,
    }));
    const linked = await supabase.from('recipe_ingredients').insert(links);
    if (linked.error) return fail(`Recipe "${recipe.title}" ingredients: ${linked.error.message}`);

    recipeIdByTitle.set(recipe.title, created.data.id);
    recipesAdded += 1;
  }

  // ---------------------------------------------------------------------
  // 3. This week's plan and its meals.
  // ---------------------------------------------------------------------
  const weekStart = currentWeekStart();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + ((7 - ((cutoff.getDay() + 6) % 7)) % 7 || 7));
  cutoff.setHours(17, 0, 0, 0);

  const plan = await supabase
    .from('weekly_plans')
    .insert({
      house_id: me.houseId,
      week_start_date: weekStart,
      week_number: isoWeekNumber(new Date(weekStart)),
      status: 'planning',
      cutoff_at: cutoff.toISOString(),
      // Not a guess. Shared savings are written by the optimiser from real
      // own-brand deltas; until the basket exists the honest figure is zero.
      shared_savings: 0,
    })
    .select('id')
    .single();

  if (plan.error) return fail(`Could not create this week's plan: ${plan.error.message}`);

  let mealsAdded = 0;
  const skipped: string[] = [];
  // Which days actually landed. Reported back so "why is there no Sunday?" is
  // answerable from the button rather than by reading the database.
  const daysSeeded = new Set<string>();

  for (const entry of DEMO_SCHEDULE) {
    const recipeId = recipeIdByTitle.get(entry.recipe);
    if (!recipeId) {
      skipped.push(entry.recipe);
      continue;
    }

    const diners = entry.diners
      .map((name) => idByName.get(name.toLowerCase()))
      .filter((id): id is string => Boolean(id));

    if (diners.length === 0) {
      skipped.push(`${entry.recipe} (nobody to eat it)`);
      continue;
    }

    const meal = await supabase
      .from('planned_meals')
      .insert({
        plan_id: plan.data.id,
        recipe_id: recipeId,
        day: entry.day,
        meal_type: entry.mealType,
        is_shared: diners.length > 1,
        created_by: diners[0],
        cooked_by_user_id: diners[0],
      })
      .select('id')
      .single();

    if (meal.error) return fail(`Meal "${entry.recipe}" on ${entry.day}: ${meal.error.message}`);

    const guestHostId = entry.guests ? idByName.get(entry.guests.who.toLowerCase()) : undefined;

    const participants = await supabase.from('meal_participants').insert(
      diners.map((userId) => ({
        planned_meal_id: meal.data.id,
        user_id: userId,
        ...(entry.guests && userId === guestHostId
          ? { guests: entry.guests.count, guests_covered: entry.guests.covered }
          : {}),
      }))
    );

    if (participants.error) {
      // 0014 not applied: the guest columns do not exist. Seed the meal without
      // them rather than failing the whole week over one +1.
      if (participants.error.code !== '42703') {
        return fail(`Diners for "${entry.recipe}": ${participants.error.message}`);
      }
      const plain = await supabase
        .from('meal_participants')
        .insert(diners.map((userId) => ({ planned_meal_id: meal.data.id, user_id: userId })));
      if (plain.error) return fail(`Diners for "${entry.recipe}": ${plain.error.message}`);
    }
    mealsAdded += 1;
    daysSeeded.add(entry.day);
  }

  // ---------------------------------------------------------------------
  // 4. A little pantry stock, so the optimiser has something to subtract and
  //    the basket is visibly smaller than the sum of the recipes.
  // ---------------------------------------------------------------------
  let pantryAdded = 0;
  for (const item of DEMO_PANTRY) {
    const ingredient = await supabase
      .from('ingredients')
      .select('id')
      .eq('canonical_name', canonicalName(item.name))
      .limit(1);
    if (!ingredient.data?.[0]) continue;

    const added = await supabase.from('pantry_items').insert({
      house_id: me.houseId,
      ingredient_id: ingredient.data[0].id,
      quantity_remaining: item.quantity,
      unit: item.unit,
      is_shared: true,
      low_stock: item.lowStock ?? false,
    });
    if (!added.error) pantryAdded += 1;
  }

  // ---------------------------------------------------------------------
  // 5. A standing staples list, so the basket carries household items the
  //    way a real house does — nobody's recipe asks for bin bags.
  // ---------------------------------------------------------------------
  let staplesAdded = 0;
  for (const staple of DEMO_STAPLES) {
    const resolved = await findOrCreateIngredient(supabase, {
      name: staple.name,
      unit: 'each',
      category: 'household',
    });
    if ('error' in resolved) continue;
    const ingredientId = resolved.id;

    const added = await supabase.from('house_staples').insert({
      house_id: me.houseId,
      ingredient_id: ingredientId,
      frequency: staple.frequency,
    });
    if (!added.error) staplesAdded += 1;
  }

  // ---------------------------------------------------------------------
  // 6. A dish on the leftovers board and one purchase from outside the shop,
  //    so both boards have something in them without anyone typing it.
  // ---------------------------------------------------------------------
  for (const leftover of DEMO_LEFTOVERS) {
    const eatBy = new Date();
    eatBy.setDate(eatBy.getDate() + leftover.daysLeft);
    const madeOn = new Date();
    madeOn.setDate(madeOn.getDate() - 1);

    await supabase.from('leftovers').insert({
      house_id: me.houseId,
      created_by: me.id,
      description: leftover.description,
      portions: leftover.portions,
      made_on: madeOn.toISOString().slice(0, 10),
      eat_by: eatBy.toISOString().slice(0, 10),
    });
  }

  for (const expense of DEMO_EXPENSES) {
    const created = await supabase
      .from('expenses')
      .insert({
        house_id: me.houseId,
        paid_by_user_id: me.id,
        description: expense.description,
        amount: expense.amount,
        note: expense.note,
      })
      .select('id')
      .single();

    if (created.error || everyone.length === 0) continue;

    // Same remainder-safe split the action uses — 1899p across five people is
    // 380/380/380/380/379, not five equal amounts that lose a penny.
    const amounts = splitPence(expense.amount, everyone.map(() => 1));
    await supabase.from('expense_shares').insert(
      everyone.map((userId, index) => ({
        expense_id: created.data.id,
        user_id: userId,
        amount: amounts[index],
        settled: userId === me.id,
      }))
    );
  }

  revalidatePath('/', 'layout');

  const note = skipped.length > 0 ? ` Skipped: ${skipped.join(', ')}.` : '';

  return {
    status: 'success',
    message:
      `Seeded ${everyone.length} housemates, ${recipesAdded} recipes, ${pantryAdded} pantry items ` +
      `and ${staplesAdded} house staples. ${mealsAdded} meals across ` +
      `${WEEKDAYS.filter((day) => daysSeeded.has(day)).join(', ')}.${note} ` +
      'No basket lines or prices were written — press Build Basket to get those from Tesco.',
  };
}

/** Removes the demo housemates again, so the house can be handed to real people. */
export async function removeDemoHousemates(): Promise<SeedResult> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const supabase = await createClient();
  const removed = await supabase.rpc('remove_demo_housemates');

  if (removed.error) return fail(removed.error.message);

  revalidatePath('/settings');
  revalidatePath('/split');
  return {
    status: 'success',
    message: `Removed ${removed.data ?? 0} demo housemate${removed.data === 1 ? '' : 's'}.`,
  };
}

/**
 * Flips this week between "planning" and "ordered" without touching Tesco.
 *
 * The post-order half of the week — marking meals cooked or skipped, bailing,
 * leftover suggestions — only appears once `weekly_plans.status` says the shop
 * has been placed. Reaching that state for real needs a Tesco session, a UK
 * address and a card, so without this the entire feature is unreachable in
 * development and would ship having never been looked at.
 *
 * It writes one column. It does not create an order, contact Tesco, or move
 * money — there is nothing here a real order would also have done, so the two
 * cannot be confused.
 */
export async function simulateOrderPlaced(placed: boolean): Promise<SeedResult> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const supabase = await createClient();
  const plan = await supabase
    .from('weekly_plans')
    .select('id')
    .eq('house_id', me.houseId)
    .order('week_start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (plan.error) return fail(plan.error.message);
  if (!plan.data) return fail('No plan for this week yet — seed one first.');

  const updated = await supabase
    .from('weekly_plans')
    .update({ status: placed ? 'ordered' : 'planning' })
    .eq('id', plan.data.id);

  if (updated.error) return fail(updated.error.message);

  revalidatePath('/', 'layout');
  return {
    status: 'success',
    message: placed
      ? 'Week marked as ordered. The Plan tab now shows what you have rather than asking what you fancy. Nothing was sent to Tesco.'
      : 'Week reopened for planning.',
  };
}
