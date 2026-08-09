'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser, getHouse, getWeeklyPlan } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { WEEKDAYS, type Weekday } from '@/lib/types';

export interface PlanActionState {
  status: 'idle' | 'error';
  message: string;
}

const OK: PlanActionState = { status: 'idle', message: '' };
const fail = (message: string): PlanActionState => ({ status: 'error', message });

/** Monday of the current week, as an ISO date. */
function currentWeekStart(): string {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

function isoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

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
async function ensurePlanId(): Promise<string> {
  const [plan, house] = await Promise.all([getWeeklyPlan(), getHouse()]);
  if (plan?.id) return plan.id;

  const supabase = createClient();
  const weekStart = currentWeekStart();

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

/**
 * Puts a recipe on a day and signs the caller up to eat it.
 *
 * If the same recipe is already planned for that day, the caller simply joins
 * it — two housemates picking the same dinner is the outcome the whole app is
 * trying to produce, so it must never create a second meal.
 */
export async function addMealToPlan(
  _prev: PlanActionState,
  formData: FormData
): Promise<PlanActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const day = asWeekday(formData.get('day'));
  const recipeId = String(formData.get('recipeId') ?? '');
  if (!day) return fail('Pick a day.');
  if (!recipeId) return fail('Pick a recipe.');

  const plan = await getWeeklyPlan();
  if (plan && plan.status !== 'planning') {
    return fail('Planning is locked for this week.');
  }

  const supabase = createClient();
  const planId = await ensurePlanId();

  const existing = await supabase
    .from('planned_meals')
    .select('id')
    .eq('plan_id', planId)
    .eq('day', day)
    .eq('recipe_id', recipeId)
    .maybeSingle();

  let mealId = existing.data?.id;

  if (!mealId) {
    const inserted = await supabase
      .from('planned_meals')
      .insert({ plan_id: planId, recipe_id: recipeId, day, cooked_by_user_id: me.id })
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
  return OK;
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

  const plan = await getWeeklyPlan();
  if (plan && plan.status !== 'planning') {
    return fail('Planning is locked for this week.');
  }

  const supabase = createClient();
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

  const supabase = createClient();
  const result = await supabase
    .from('profiles')
    .update({ dietary_preferences: constraints })
    .eq('id', me.id);

  if (result.error) return fail(result.error.message);

  revalidatePath('/plan');
  revalidatePath('/account');
  return OK;
}
