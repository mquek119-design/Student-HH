'use server';

import { revalidatePath } from 'next/cache';
import {
  getCurrentUser,
  getHouse,
  getMealContext,
  getWeeklyPlan,
  getWeeklyPlanFor,
} from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { canSetCapacity } from '@/lib/meals';
import {
  currentWeekStart,
  isCutoffPassed,
  isDayPast,
  isoWeekNumber,
  parseWeekChoice,
  weekStartFor,
  type WeekChoice,
} from '@/lib/weeks';
import type { PlannedMeal } from '@/lib/types';
import {
  MEAL_STATUSES,
  MEAL_TYPES,
  WEEKDAY_LABELS,
  WEEKDAYS,
  type MealStatus,
  type MealType,
  type Weekday,
} from '@/lib/types';

export interface PlanActionState {
  status: 'idle' | 'error' | 'success';
  message: string;
}

const OK: PlanActionState = { status: 'idle', message: '' };

/** Distinct from OK so a sheet can close itself without guessing. */
const DONE: PlanActionState = { status: 'success', message: '' };
const fail = (message: string): PlanActionState => ({ status: 'error', message });

function nextCutoff(cutoffDay: Weekday, cutoffTime: string): string {
  const dayIndex = WEEKDAYS.indexOf(cutoffDay);
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

/**
 * Returns this week's plan id, creating the row on first use.
 *
 * Plans are created lazily rather than on a schedule: the first housemate to
 * add a meal brings the week into existence. `week_start_date` is unique per
 * house, so two people doing this at once cannot create duplicates — the loser
 * of the race re-reads the winner's row.
 */
async function ensurePlanId(weekStart: string = currentWeekStart()): Promise<string> {
  const [plan, house] = await Promise.all([getWeeklyPlanFor(weekStart), getHouse()]);
  if (plan?.id) return plan.id;

  const supabase = await createClient();

  const inserted = await supabase
    .from('weekly_plans')
    .insert({
      house_id: house.id,
      week_start_date: weekStart,
      week_number: isoWeekNumber(new Date(weekStart)),
      cutoff_at: nextCutoff(house.cutoffDay, house.cutoffTime),
    })
    .select('id')
    .single();

  if (inserted.data) return inserted.data.id;

  const existing = await supabase
    .from('weekly_plans')
    .select('id')
    .eq('house_id', house.id)
    .eq('week_start_date', weekStart)
    .maybeSingle();

  if (!existing.data) {
    throw new Error(inserted.error?.message ?? 'Could not create this week&apos;s plan');
  }
  return existing.data.id;
}

function asWeekday(value: FormDataEntryValue | null): Weekday | null {
  const raw = String(value ?? '');
  return (WEEKDAYS as string[]).includes(raw) ? (raw as Weekday) : null;
}

/** Defaults to dinner: it is what a student house plans, and what old rows are. */
function asMealType(value: FormDataEntryValue | null): MealType {
  const raw = String(value ?? '');
  return (MEAL_TYPES as string[]).includes(raw) ? (raw as MealType) : 'dinner';
}

/**
 * Puts a recipe on a day and signs the caller up to eat it.
 *
 * If the same recipe is already planned for that *sitting*, the caller simply
 * joins it — two housemates picking the same dinner is the outcome the whole
 * app is trying to produce, so it must never create a second meal.
 *
 * The match is on day **and** meal type. Matching on the day alone would sign
 * someone up to Tuesday breakfast when they asked for Tuesday dinner, and the
 * two would then be scaled and costed as one meal for twice the diners.
 */
export async function addMealToPlan(
  _prev: PlanActionState,
  formData: FormData
): Promise<PlanActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const day = asWeekday(formData.get('day'));
  const mealType = asMealType(formData.get('mealType'));
  const recipeId = String(formData.get('recipeId') ?? '');
  const week: WeekChoice = parseWeekChoice(String(formData.get('week') ?? ''));
  if (!day) return fail('Pick a day.');
  if (!recipeId) return fail('Pick a recipe.');

  const weekStart = weekStartFor(week);
  const plan = await getWeeklyPlanFor(weekStart);
  if (plan && plan.id && plan.status !== 'planning') {
    return fail('The shop for that week has gone in — nothing more can be added to it.');
  }
  if (plan && plan.cutoffAt && isCutoffPassed(plan.cutoffAt)) {
    return fail('Planning has closed for this week. No more changes allowed.');
  }

  // The day card hides the link once a day has gone, but the UI cannot be the
  // only thing enforcing it — a stale tab still posts to this action.
  if (isDayPast(weekStart, day)) {
    return fail(`${WEEKDAY_LABELS[day]} has been and gone. Put it on a day still to come.`);
  }

  const supabase = await createClient();
  const planId = await ensurePlanId(weekStart);

  const existing = await supabase
    .from('planned_meals')
    .select('id')
    .eq('plan_id', planId)
    .eq('day', day)
    .eq('meal_type', mealType)
    .eq('recipe_id', recipeId)
    .maybeSingle();

  let mealId = existing.data?.id;

  if (!mealId) {
    const inserted = await supabase
      .from('planned_meals')
      .insert({
        plan_id: planId,
        recipe_id: recipeId,
        day,
        meal_type: mealType,
        created_by: me.id,
        cooked_by_user_id: me.id,
      })
      .select('id')
      .single();
    if (inserted.error || !inserted.data) {
      return fail(inserted.error?.message ?? 'Could not add that meal.');
    }
    mealId = inserted.data.id;
  }

  const participant = await supabase
    .from('meal_participants')
    .upsert({ planned_meal_id: mealId, user_id: me.id, opted_out: false });
  if (participant.error) return fail(participant.error.message);

  // A meal two or more people are eating is shared by definition.
  const { count } = await supabase
    .from('meal_participants')
    .select('user_id', { count: 'exact', head: true })
    .eq('planned_meal_id', mealId)
    .eq('opted_out', false);

  await supabase
    .from('planned_meals')
    .update({ is_shared: (count ?? 1) > 1 })
    .eq('id', mealId);

  revalidatePath('/plan');
  revalidatePath('/');
  return DONE;
}

/**
 * Removes the caller from a meal. When nobody is left eating it, the meal row
 * goes too — an empty meal on the grid is just noise.
 */
export async function leaveMeal(
  _prev: PlanActionState,
  formData: FormData
): Promise<PlanActionState> {
  const me = await getCurrentUser();
  const mealId = String(formData.get('mealId') ?? '');
  if (!mealId) return fail('Missing meal.');

  const context = await getMealContext(mealId);
  if (!context) return fail('That meal is not in your house.');
  if (context.planStatus !== 'planning') {
    return fail('The shop for that week has gone in — your share is already bought.');
  }
  if (context.cutoffAt && isCutoffPassed(context.cutoffAt)) {
    return fail('Planning has closed for this week. No more changes allowed.');
  }

  const supabase = await createClient();
  const removed = await supabase
    .from('meal_participants')
    .delete()
    .eq('planned_meal_id', mealId)
    .eq('user_id', me.id);
  if (removed.error) return fail(removed.error.message);

  const remaining = await supabase
    .from('meal_participants')
    .select('user_id')
    .eq('planned_meal_id', mealId)
    .eq('opted_out', false);

  const count = remaining.data?.length ?? 0;
  if (count === 0) {
    await supabase.from('planned_meals').delete().eq('id', mealId);
  } else {
    await supabase.from('planned_meals').update({ is_shared: count > 1 }).eq('id', mealId);
  }

  revalidatePath('/plan');
  revalidatePath('/');
  return OK;
}

/** Saves the caller's dietary constraints onto their profile. */
export async function saveConstraints(
  _prev: PlanActionState,
  formData: FormData
): Promise<PlanActionState> {
  const me = await getCurrentUser();

  const constraints = formData
    .getAll('constraint')
    .map((value) => String(value).trim())
    .filter(Boolean);

  const supabase = await createClient();
  const result = await supabase
    .from('profiles')
    .update({ dietary_preferences: constraints })
    .eq('id', me.id);

  if (result.error) return fail(result.error.message);

  revalidatePath('/plan');
  revalidatePath('/account');
  return OK;
}

/**
 * Puts a locked week back into planning.
 *
 * A plan leaves `planning` when the order is pushed to Tesco, which is right in
 * production but leaves the week permanently uneditable — and a bug used to
 * push on every basket rebuild, stranding plans in `ordered` that were never
 * ordered. Without a way back the house simply cannot change its meals.
 *
 * Deliberately allowed even after `ordered`: the shop being placed does not
 * mean next week's thinking should be frozen, and the basket is regenerated
 * from the plan anyway.
 */
export async function reopenPlanning(): Promise<PlanActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const plan = await getWeeklyPlan();
  if (!plan?.id) return fail('No plan for this week yet.');
  if (plan.status === 'planning') return OK;

  const supabase = await createClient();
  const result = await supabase
    .from('weekly_plans')
    .update({ status: 'planning' })
    .eq('id', plan.id)
    .eq('house_id', me.houseId);

  if (result.error) return fail(result.error.message);

  revalidatePath('/plan');
  revalidatePath('/basket');
  revalidatePath('/');
  return OK;
}

// ---------------------------------------------------------------------------
// After the order — the part of the week that used to have no controls
// ---------------------------------------------------------------------------
//
// Nothing below moves money, and that is the point. Once the shop is placed,
// every person's cost is settled: the ingredients exist and they are paid for.
// Marking a meal skipped, bailing on it, or cooking something else entirely
// changes what happens in the kitchen and nothing at all on the split.

/** Meals can only be marked once the food has actually been bought. */
async function requireOrderedPlan(): Promise<
  { ok: true; planId: string } | { ok: false; state: PlanActionState }
> {
  const plan = await getWeeklyPlan();
  if (!plan?.id) return { ok: false, state: fail('No plan for this week yet.') };
  if (plan.status === 'planning' || plan.status === 'locked') {
    return {
      ok: false,
      state: fail('The shop has not been placed yet — change the plan instead of marking it.'),
    };
  }
  return { ok: true, planId: plan.id };
}

/**
 * Records what actually happened to a meal.
 *
 * `skipped` is the interesting one: it is what triggers the leftover
 * suggestions, because the ingredients are sitting in the fridge with nothing
 * planned for them. `swapped` means someone cooked something else out of the
 * same food — worth distinguishing, since a swapped meal is a success and a
 * skipped one is food at risk.
 *
 * Only the meal's cook can mark it as cooked. Others can mark it skipped or
 * swapped (kitchen facts), but the decision to claim it was cooked is the
 * cook's responsibility.
 */
export async function setMealStatus(
  _prev: PlanActionState,
  formData: FormData
): Promise<PlanActionState> {
  const me = await getCurrentUser();
  const mealId = String(formData.get('mealId') ?? '');
  const raw = String(formData.get('status') ?? '');
  if (!mealId) return fail('Missing meal.');
  if (!MEAL_STATUSES.includes(raw as MealStatus)) return fail('Unknown status.');

  const gate = await requireOrderedPlan();
  if (!gate.ok) return gate.state;

  const context = await getMealContext(mealId);
  if (!context) return fail('That meal is not in your house.');

  // Only the cook can mark a meal as cooked. Others can mark it skipped/swapped.
  if (raw === 'cooked' && context.meal.cookedByUserId !== me.id) {
    return fail('Only the cook can mark this as cooked.');
  }

  const supabase = await createClient();
  const updated = await supabase
    .from('planned_meals')
    .update({ status: raw as MealStatus })
    .eq('id', mealId)
    .eq('plan_id', gate.planId);

  if (updated.error) {
    const hint =
      updated.error.code === '42703'
        ? ' — run supabase/migrations/0013_meal_lifecycle_and_staples.sql.'
        : '';
    return fail(`${updated.error.message}${hint}`);
  }

  revalidatePath('/plan');
  revalidatePath('/leftovers');
  revalidatePath('/');
  return OK;
}

/**
 * Drops the caller out of a meal *after* the order.
 *
 * Unlike `leaveMeal`, this keeps the row. The food was bought with their money
 * and belongs to them; deleting the participant would strip them from the
 * allocation and hand their share of the cost to everyone else, days after the
 * split was agreed. Bailing is a kitchen fact, not an accounting one.
 */
export async function bailFromMeal(
  _prev: PlanActionState,
  formData: FormData
): Promise<PlanActionState> {
  const me = await getCurrentUser();
  const mealId = String(formData.get('mealId') ?? '');
  const undo = String(formData.get('undo') ?? '') === 'true';
  if (!mealId) return fail('Missing meal.');

  const gate = await requireOrderedPlan();
  if (!gate.ok) return gate.state;

  const supabase = await createClient();
  const updated = await supabase
    .from('meal_participants')
    .update({ bailed: !undo })
    .eq('planned_meal_id', mealId)
    .eq('user_id', me.id);

  if (updated.error) {
    const hint =
      updated.error.code === '42703'
        ? ' — run supabase/migrations/0013_meal_lifecycle_and_staples.sql.'
        : '';
    return fail(`${updated.error.message}${hint}`);
  }

  revalidatePath('/plan');
  revalidatePath('/');
  return OK;
}

/**
 * Cooking is offered, never assigned.
 *
 * `setCook` used to take any meal id and any user id, validate that the
 * *target* was a diner, and write it — the **caller** was never checked at all.
 * So anybody in the house could put your name against Thursday's dinner on a
 * meal they were not even eating, and the first you would know of it was the
 * reminder on the day.
 *
 * The rule now, in four actions:
 *
 *   * whoever adds a meal is its cook, automatically (`addMealToPlan`);
 *   * only the current cook may hand it over, and that creates a pending offer;
 *   * the person asked accepts or declines — until they accept, the original
 *     cook is still cooking;
 *   * a cook may stand down, leaving the meal for any diner to claim.
 *
 * Nobody ends up on the hook for a meal they did not agree to.
 */

/** Shared preamble: the meal, and whether the caller is eating it. */
type CookContext =
  | { ok: false; state: PlanActionState }
  | { ok: true; me: Awaited<ReturnType<typeof getCurrentUser>>; meal: PlannedMeal; isDiner: boolean };

async function cookContext(mealId: string): Promise<CookContext> {
  const me = await getCurrentUser();
  const context = await getMealContext(mealId);
  if (!context) return { ok: false, state: fail('That meal is not in your house.') };
  if (context.planStatus !== 'planning') {
    return { ok: false, state: fail('The shop has gone in — the week is settled.') };
  }
  if (context.cutoffAt && isCutoffPassed(context.cutoffAt)) {
    return { ok: false, state: fail('Planning has closed for this week. No more changes allowed.') };
  }
  const isDiner = context.meal.participants.some(
    (participant) => participant.userId === me.id
  );
  return { ok: true, me, meal: context.meal, isDiner };
}

/** Takes an unclaimed meal. Any diner may, because nobody is being volunteered. */
export async function claimCook(
  _prev: PlanActionState,
  formData: FormData
): Promise<PlanActionState> {
  const mealId = String(formData.get('mealId') ?? '');
  if (!mealId) return fail('Missing meal.');

  const context = await cookContext(mealId);
  if (!context.ok) return context.state;
  const { me, meal, isDiner } = context;

  if (!isDiner) return fail('Only somebody eating the meal can cook it.');
  if (meal.cookedByUserId) {
    return fail('Somebody is already cooking that one — ask them to hand it over.');
  }

  const supabase = await createClient();
  const updated = await supabase
    .from('planned_meals')
    .update({ cooked_by_user_id: me.id, cook_offer_to: null })
    .eq('id', mealId);
  if (updated.error) return fail(updated.error.message);

  revalidatePath('/plan');
  revalidatePath('/');
  return OK;
}

/**
 * Asks somebody else to take it. An offer, not a handover — `cooked_by_user_id`
 * does not move until they say yes.
 */
export async function offerCook(
  _prev: PlanActionState,
  formData: FormData
): Promise<PlanActionState> {
  const mealId = String(formData.get('mealId') ?? '');
  const userId = String(formData.get('userId') ?? '');
  if (!mealId || !userId) return fail('Missing meal or housemate.');

  const context = await cookContext(mealId);
  if (!context.ok) return context.state;
  const { me, meal } = context;

  if (meal.cookedByUserId !== me.id) {
    return fail('Only whoever is cooking can hand it over.');
  }
  if (userId === me.id) return fail('You are already cooking it.');
  if (!meal.participants.some((participant) => participant.userId === userId)) {
    return fail('Only somebody eating the meal can cook it.');
  }

  const supabase = await createClient();
  const updated = await supabase
    .from('planned_meals')
    .update({ cook_offer_to: userId })
    .eq('id', mealId);
  if (updated.error) {
    const hint =
      updated.error.code === '42703'
        ? ' — run supabase/migrations/0019_cook_offers.sql.'
        : '';
    return fail(`${updated.error.message}${hint}`);
  }

  revalidatePath('/plan');
  revalidatePath('/');
  return OK;
}

/**
 * Answers an offer.
 *
 * Accepting moves the cooking across; declining leaves it exactly where it was.
 * Only the person asked can answer — the cook cannot accept on their behalf,
 * which is the entire point.
 */
export async function respondToCookOffer(
  _prev: PlanActionState,
  formData: FormData
): Promise<PlanActionState> {
  const mealId = String(formData.get('mealId') ?? '');
  const accept = String(formData.get('accept') ?? '') === 'true';
  if (!mealId) return fail('Missing meal.');

  const context = await cookContext(mealId);
  if (!context.ok) return context.state;
  const { me, meal } = context;

  if (meal.cookOfferTo !== me.id) {
    return fail('That offer is not yours to answer.');
  }

  const supabase = await createClient();
  const updated = await supabase
    .from('planned_meals')
    .update(
      accept
        ? { cooked_by_user_id: me.id, cook_offer_to: null }
        : { cook_offer_to: null }
    )
    .eq('id', mealId);
  if (updated.error) return fail(updated.error.message);

  revalidatePath('/plan');
  revalidatePath('/');
  return OK;
}

/**
 * Steps back from cooking, or withdraws an offer nobody has answered.
 *
 * Leaves the meal unclaimed rather than pushing it onto somebody — the food is
 * still planned, it just needs a volunteer.
 */
export async function standDownAsCook(
  _prev: PlanActionState,
  formData: FormData
): Promise<PlanActionState> {
  const mealId = String(formData.get('mealId') ?? '');
  if (!mealId) return fail('Missing meal.');

  const context = await cookContext(mealId);
  if (!context.ok) return context.state;
  const { me, meal } = context;

  if (meal.cookedByUserId !== me.id) {
    return fail('You are not the one cooking that.');
  }

  const supabase = await createClient();
  const updated = await supabase
    .from('planned_meals')
    .update({ cooked_by_user_id: null, cook_offer_to: null })
    .eq('id', mealId);
  if (updated.error) return fail(updated.error.message);

  revalidatePath('/plan');
  revalidatePath('/');
  return OK;
}

/**
 * How many mouths a meal is cooked for.
 *
 * **Only the person who put the meal on the plan.** This is the one control on
 * the plan that is deliberately not communal: everything else here — joining,
 * leaving, volunteering to cook — is something the house does together, but
 * "I'm cooking for three" is a statement about somebody's own pan, and a
 * housemate quietly raising the cap to squeeze in is exactly the argument the
 * feature exists to prevent. The cook can change hands during the week without
 * handing over this decision.
 *
 * It never removes anybody. Lowering the number below the people already in
 * only stops the next person; kicking a housemate off a meal they had planned
 * around is not something a stepper should do by accident, and after the order
 * it would move their money too.
 */
export async function setMealCapacity(
  _prev: PlanActionState,
  formData: FormData
): Promise<PlanActionState> {
  const me = await getCurrentUser();
  const mealId = String(formData.get('mealId') ?? '');
  if (!mealId) return fail('Missing meal.');

  const raw = String(formData.get('maxDiners') ?? '');
  const max = raw === '' || raw === 'null' ? null : Number(raw);
  if (max !== null && (!Number.isInteger(max) || max < 1 || max > 20)) {
    return fail('Between 1 and 20, or no limit.');
  }

  const context = await getMealContext(mealId);
  if (!context) return fail('That meal is not in your house.');
  const meal = context.meal;
  if (!canSetCapacity(meal, me.id)) {
    return fail('Only whoever put this meal on can say how many it feeds.');
  }
  if (context.planStatus !== 'planning') {
    return fail('The shop is placed — the pan is already accounted for.');
  }

  const supabase = await createClient();
  const updated = await supabase
    .from('planned_meals')
    .update({ max_diners: max })
    .eq('id', mealId)
    .eq('plan_id', meal.planId);

  if (updated.error) {
    const hint =
      updated.error.code === '42703'
        ? ' — run supabase/migrations/0017_meal_capacity.sql.'
        : '';
    return fail(`${updated.error.message}${hint}`);
  }

  revalidatePath('/plan');
  revalidatePath('/');
  return OK;
}

/**
 * Sets how many guests the caller is bringing to a meal, and who pays.
 *
 * Planning only. After the order there is nothing to decide: the food is
 * bought, so bringing someone means cooking your own ingredients for two —
 * your food, your call, no app interaction needed.
 *
 * Guests never become participants. They have no account, no balance and no
 * vote; they are extra mouths attached to whoever invited them, and the
 * optimiser folds their weight into that person (or across the table).
 */
export async function setGuests(
  _prev: PlanActionState,
  formData: FormData
): Promise<PlanActionState> {
  const me = await getCurrentUser();
  const mealId = String(formData.get('mealId') ?? '');
  if (!mealId) return fail('Missing meal.');

  // Whichever control was pressed sends its own field; the other arrives as the
  // `current*` hidden value so one button never clears the other's setting.
  const guests = Number(formData.get('guests') ?? formData.get('currentGuests') ?? 0);
  if (!Number.isInteger(guests) || guests < 0 || guests > 6) {
    return fail('Between 0 and 6 guests.');
  }
  const covered =
    String(formData.get('setCovered') ?? formData.get('currentCovered') ?? 'true') !== 'false';

  const context = await getMealContext(mealId);
  if (!context) return fail('That meal is not in your house.');
  if (context.planStatus !== 'planning') {
    return fail('The shop is placed — just cook what you have for one more.');
  }

  // A +3 must not walk through a cap that a join would have been refused by.
  const meal = context.meal;
  if (meal.maxDiners != null) {
    const others = meal.participants
      .filter((participant) => participant.userId !== me.id)
      .reduce((sum, participant) => sum + 1 + (participant.guests ?? 0), 0);
    if (others + 1 + guests > meal.maxDiners) {
      return fail(`That meal is cooked for ${meal.maxDiners} — there isn't room for that many.`);
    }
  }

  const supabase = await createClient();
  const updated = await supabase
    .from('meal_participants')
    .update({ guests, guests_covered: covered })
    .eq('planned_meal_id', mealId)
    .eq('user_id', me.id);

  if (updated.error) {
    const hint =
      updated.error.code === '42703'
        ? ' — run supabase/migrations/0014_guests_expenses_leftovers.sql.'
        : '';
    return fail(`${updated.error.message}${hint}`);
  }

  revalidatePath('/plan');
  revalidatePath('/');
  return OK;
}

/**
 * Signs the caller up to a meal somebody else already planned.
 *
 * Joining is always a choice and never automatic. Two housemates eating the
 * same thing is what the whole app is for, but "Alex is doing a curry" is an
 * invitation, not a rota — anyone can add their own separate meal for the same
 * night instead, and the plan grid shows both.
 */
export async function joinMeal(
  _prev: PlanActionState,
  formData: FormData
): Promise<PlanActionState> {
  const me = await getCurrentUser();
  const mealId = String(formData.get('mealId') ?? '');
  if (!mealId) return fail('Missing meal.');

  // Resolved from the meal, not from "the current week" — the same action has
  // to work on a meal somebody put on next week's plan.
  const context = await getMealContext(mealId);
  if (!context) return fail('That meal is not in your house.');
  if (context.planStatus !== 'planning') {
    return fail('The shop for that week has gone in.');
  }
  if (context.cutoffAt && isCutoffPassed(context.cutoffAt)) {
    return fail('Planning has closed for this week. No more changes allowed.');
  }
  const meal = context.meal;

  // Same guard as adding: you cannot sign up to Monday's dinner on Thursday.
  // Leaving is deliberately not guarded — see leaveMeal.
  if (isDayPast(context.weekStartDate, meal.day)) {
    return fail(`${WEEKDAY_LABELS[meal.day]} has been and gone.`);
  }

  // Mouths, not housemates — a guest eats out of the same pan.
  const mouths = meal.participants.reduce(
    (sum, participant) => sum + 1 + (participant.guests ?? 0),
    0
  );
  if (meal.maxDiners !== null && mouths >= meal.maxDiners) {
    return fail(
      `That one's cooked for ${meal.maxDiners}. Add your own meal for the same night instead.`
    );
  }

  const supabase = await createClient();
  const joined = await supabase
    .from('meal_participants')
    .upsert({ planned_meal_id: mealId, user_id: me.id, opted_out: false });
  if (joined.error) return fail(joined.error.message);

  const { count } = await supabase
    .from('meal_participants')
    .select('user_id', { count: 'exact', head: true })
    .eq('planned_meal_id', mealId)
    .eq('opted_out', false);

  await supabase
    .from('planned_meals')
    .update({ is_shared: (count ?? 1) > 1 })
    .eq('id', mealId);

  revalidatePath('/plan');
  revalidatePath('/');
  return OK;
}

/**
 * Takes somebody off a meal.
 *
 * Only whoever put the meal on, and only while the week is still being
 * planned. After the order it is refused outright: their share of that food is
 * bought and paid for, so removing them would hand their money to everyone else
 * days after the split was agreed. That is the same reason `bailed` exists
 * rather than a delete — see CLAUDE.md, "The week has two halves".
 *
 * You cannot remove yourself; that is Leave, and it behaves differently (it
 * bins the meal when nobody is left).
 */
export async function removeFromMeal(
  _prev: PlanActionState,
  formData: FormData
): Promise<PlanActionState> {
  const me = await getCurrentUser();
  const mealId = String(formData.get('mealId') ?? '');
  const userId = String(formData.get('userId') ?? '');
  if (!mealId || !userId) return fail('Missing meal or housemate.');
  if (userId === me.id) return fail('Use Leave to take yourself off a meal.');

  const context = await getMealContext(mealId);
  if (!context) return fail('That meal is not in your house.');

  if (!canSetCapacity(context.meal, me.id)) {
    return fail('Only whoever put this meal on can take somebody off it.');
  }
  if (context.planStatus !== 'planning') {
    return fail(
      'The shop has gone in — their share of that food is already bought and it is theirs.'
    );
  }

  const supabase = await createClient();
  const removed = await supabase
    .from('meal_participants')
    .delete()
    .eq('planned_meal_id', mealId)
    .eq('user_id', userId);
  if (removed.error) return fail(removed.error.message);

  // Somebody who is no longer eating it cannot be down to cook it.
  if (context.meal.cookedByUserId === userId) {
    await supabase.from('planned_meals').update({ cooked_by_user_id: null }).eq('id', mealId);
  }

  const remaining = await supabase
    .from('meal_participants')
    .select('user_id')
    .eq('planned_meal_id', mealId)
    .eq('opted_out', false);

  await supabase
    .from('planned_meals')
    .update({ is_shared: (remaining.data?.length ?? 0) > 1 })
    .eq('id', mealId);

  revalidatePath('/plan');
  revalidatePath('/');
  return OK;
}
