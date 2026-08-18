import { redirect } from 'next/navigation';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { RecipeBrowser } from '@/components/recipes/RecipeBrowser';
import { ImportRecipeCard } from '@/components/recipes/ImportRecipeCard';
import { getCurrentUser, getRecipes, getWeeklyPlan } from '@/lib/queries';
import { WEEKDAYS, WEEKDAY_LABELS, type Weekday } from '@/lib/types';
import { parseWeekChoice } from '@/lib/weeks';

export const metadata = { title: 'Recipes · Grub' };
export const dynamic = 'force-dynamic';

/**
 * The house recipe book — and where meals get planned from.
 *
 * The old version stacked four fixed sections (Pantry Match, House Favourites,
 * 20 Minutes or Less, All Recipes), which meant a popular recipe appeared three
 * times and there was no way to ask for "quick AND veggie". Those sections are
 * now filter chips over one grid, which does strictly more with less screen.
 *
 * Reached from the Plan tab rather than owning a bottom-nav tab: it is a
 * library you visit, not a stage of the week you check. Arriving from a day
 * card carries the day through and returns you to the week afterwards.
 */
export default async function RecipesPage({
  searchParams,
}: {
  searchParams?: { day?: string; week?: string };
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser.houseId) redirect('/onboarding');

  const [recipes, plan] = await Promise.all([getRecipes(), getWeeklyPlan()]);

  const requested = String(searchParams?.day ?? '');
  const planningForDay = (WEEKDAYS as string[]).includes(requested)
    ? (requested as Weekday)
    : undefined;

  const week = parseWeekChoice(searchParams?.week);

  // Next week is always open; only the week being eaten can be locked by an
  // order that has already gone in.
  const locked = week === 'this' && Boolean(plan && plan.id && plan.status !== 'planning');

  return (
    <PageShell>
      <PageHeader
        title="Recipes"
        subtitle={
          planningForDay
            ? `Pick something for ${WEEKDAY_LABELS[planningForDay]}${week === 'next' ? ' next week' : ''}.`
            : 'Everything the house can cook. Tap one to put it on a night.'
        }
        action={
          <ButtonLink href="/recipes/new" icon="add" className="shrink-0">
            Add
          </ButtonLink>
        }
      />

      {planningForDay && (
        <ButtonLink href={week === 'next' ? '/plan?week=next' : '/plan'} variant="ghost" size="sm" icon="arrow_back" className="self-start -ml-sm">
          Back to the week
        </ButtonLink>
      )}

      {recipes.length === 0 ? (
        <EmptyState
          icon="ti-soup"
          title="Absolutely nothing here"
          body="Paste a link or write one out. Everything else in Grub is built on top of this, so it's the one bit you can't skip."
          action={{ href: '/recipes/new', label: 'Add your first recipe' }}
        />
      ) : (
        <RecipeBrowser
          recipes={recipes}
          locked={locked}
          planningForDay={planningForDay}
          week={week}
        />
      )}

      <ImportRecipeCard />
    </PageShell>
  );
}
