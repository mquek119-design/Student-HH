import { redirect } from 'next/navigation';
import { KitchenPanel } from '@/components/plan/KitchenPanel';
import { NavCard } from '@/components/plan/NavCard';
import { OverlapHints } from '@/components/plan/OverlapHints';
import { WeekPlan } from '@/components/plan/WeekPlan';
import { WeekSwitcher } from '@/components/plan/WeekSwitcher';
import { ReopenPlanningBanner } from '@/components/plan/ReopenPlanningBanner';
import { FirstMealModal } from '@/components/plan/FirstMealModal';
import { Icon } from '@/components/media/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { formatPence } from '@/lib/money';
import {
  getCurrentUser,
  getHousemates,
  getRecipes,
  getWeeklyPlan,
  getWeeklyPlanFor,
} from '@/lib/queries';
import { nextWeekStart, parseWeekChoice } from '@/lib/weeks';

export const metadata = { title: 'Plan · Grub' };

// The cutoff deadline shown here moves with the clock.
export const dynamic = 'force-dynamic';

/**
 * Two weeks, and they are different kinds of thing.
 *
 * **This week** is what the house is eating. Once the shop is placed it stops
 * being a plan and becomes a record: the food is bought, the split is settled,
 * and the screen shows what you have rather than asking what you want.
 *
 * **Next week** is still a decision, and stays editable regardless — you should
 * be able to think about Thursday while this week is still in the fridge.
 *
 * Only this week can be shopped. The Basket, Split and Feed all mean the
 * current week; a second open plan must never quietly become the one costed.
 */
export default async function PlanPage({
  searchParams,
}: {
  searchParams?: { week?: string };
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser.houseId) redirect('/onboarding');

  const week = parseWeekChoice(searchParams?.week);

  const [thisWeek, nextWeek, recipes, housemates] = await Promise.all([
    getWeeklyPlan(),
    getWeeklyPlanFor(nextWeekStart()),
    getRecipes(),
    getHousemates(),
  ]);
  if (!thisWeek) redirect('/onboarding');

  const plan = week === 'next' ? (nextWeek ?? thisWeek) : thisWeek;

  const cutoff = new Date(thisWeek.cutoffAt).toLocaleString('en-GB', {
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
  });

  // Once the shop is placed the question stops being "what do you fancy?" —
  // the food is bought. Deliberately unnamed in the UI: housemates experience
  // one screen that changes with the week, not a mode they have to understand.
  const thisWeekLocked = thisWeek.status === 'ordered' || thisWeek.status === 'delivered';
  const showKitchen = week === 'this' && thisWeekLocked;

  const switcher = (
    <WeekSwitcher
      week={week}
      thisWeekLocked={thisWeekLocked}
      nextWeekMealCount={nextWeek?.meals.length ?? 0}
    />
  );

  if (showKitchen) {
    return (
      <PageShell>
        <PageHeader title="Your Week" subtitle="Shop's in. This is what you're working with." />
        {switcher}
        <ReopenPlanningBanner status={thisWeek.status} />
        <KitchenPanel plan={thisWeek} recipes={recipes} currentUser={currentUser} />
      </PageShell>
    );
  }

  return (
    <PageShell wide>
      <PageHeader
        title="Your Week"
        subtitle={
          week === 'next'
            ? "Nothing here is bought yet. Get ahead while this week cooks itself."
            : `Say what you fancy before ${cutoff}. After that it's whatever everyone else wanted.`
        }
      />

      {switcher}

      {week === 'this' && <ReopenPlanningBanner status={thisWeek.status} />}

      {/* Only shown once there is a real figure behind it — the optimiser's
          own-brand and pooling deltas, never an estimate. Next week has no
          basket, so it has no savings to report. */}
      {week === 'this' && plan.sharedSavings > 0 && (
        <div className="flex items-center justify-between gap-md px-md py-3 rounded-xl bg-primary text-on-primary shadow-ambient-card">
          <span className="flex items-center gap-sm font-label-caps text-label-caps uppercase tracking-wider">
            <Icon name="savings" filled />
            Shared savings
          </span>
          <span className="font-numeric-data text-title-md font-bold">
            {formatPence(plan.sharedSavings)}
          </span>
        </div>
      )}

      {week === 'next' && (
        <Notice tone="info" icon="event_upcoming">
          The basket is only ever built from the week the house is actually eating, so nothing here
          is costed or ordered yet. This becomes the current week on Monday and the shop follows
          from it.
        </Notice>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
        <NavCard
          href={week === 'next' ? '/recipes?week=next' : '/recipes'}
          icon="menu_book"
          title="Recipe hub"
          detail="Everything the house can cook"
        />
        <NavCard
          href="/recipes#import"
          icon="link"
          title="Import a recipe"
          detail="Nick one off the internet"
          tone="secondary"
        />
      </div>

      {recipes.length === 0 ? (
        <>
          <EmptyState
            icon="ti-soup"
            title="No recipes, no plan"
            body="The week is built out of the recipe book, and the book is empty. Write one out or paste a link — it takes a minute and then it's there forever."
            action={{ href: '/recipes/new', label: 'Add a recipe' }}
          />
        </>
      ) : (
        <>
          {/* Show first-meal nudge if this week is empty and we're on this week */}
          {week === 'this' && plan.meals.length === 0 && (
            <FirstMealModal recipes={recipes} />
          )}
          <WeekPlan plan={plan} housemates={housemates} currentUser={currentUser} week={week} />
          <OverlapHints overlaps={plan.overlaps} />
        </>
      )}
    </PageShell>
  );
}
