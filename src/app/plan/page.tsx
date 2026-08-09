import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FancyForm } from '@/components/plan/FancyForm';
import { PlanGrid } from '@/components/plan/PlanGrid';
import { Icon } from '@/components/media/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { formatPence } from '@/lib/money';
import { getCurrentUser, getHousemates, getRecipes, getWeeklyPlan } from '@/lib/queries';

export const metadata = { title: 'Plan · HouseGrocer' };

// The cutoff deadline shown here moves with the clock.
export const dynamic = 'force-dynamic';

/**
 * The Plan tab holds both halves of the planning flow: "What do you fancy?"
 * input up top, then the house-wide grid built from everyone's answers.
 */
export default async function PlanPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser.houseId) redirect('/onboarding');

  const [plan, recipes, housemates] = await Promise.all([
    getWeeklyPlan(),
    getRecipes(),
    getHousemates(),
  ]);
  if (!plan) redirect('/onboarding');

  const cutoff = new Date(plan.cutoffAt).toLocaleString('en-GB', {
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <PageShell wide>
      <PageHeader
        title="Your Week"
        subtitle={`Update your meals and constraints by ${cutoff}.`}
        action={
          <Link
            href="/recipes"
            className="hidden sm:flex items-center gap-xs px-md py-sm rounded-full border border-primary text-primary font-semibold text-[14px] hover:bg-primary/10 transition-colors shrink-0"
          >
            <Icon name="menu_book" className="text-[18px]" />
            Recipes
          </Link>
        }
      />

      {recipes.length === 0 ? (
        <EmptyState
          icon="menu_book"
          title="Add a recipe first"
          body="The plan is built from recipes, so the house needs at least one before anyone can say what they fancy."
          action={{ href: '/recipes/new', label: 'Add a recipe' }}
        />
      ) : (
        <section id="roster" className="flex flex-col gap-md scroll-mt-[88px]">
          <h2 className="font-title-md text-title-md text-on-background">What do you fancy?</h2>
          <FancyForm
            plan={plan}
            recipes={recipes}
            currentUser={currentUser}
            housemates={housemates}
          />
        </section>
      )}

      <section className="flex flex-col gap-md">
        <div className="flex items-center justify-between gap-sm">
          <h2 className="font-title-md text-title-md text-on-background">The House Plan</h2>
          <Link
            href="/pantry"
            className="flex items-center gap-xs text-primary font-semibold text-[14px] hover:opacity-80"
          >
            <Icon name="kitchen" className="text-[18px]" />
            Pantry
          </Link>
        </div>

        {/* Only shown once there is a real figure behind it. */}
        {plan.sharedSavings > 0 && (
          <div className="flex items-center justify-between gap-md px-md py-3 rounded-lg bg-gradient-to-r from-primary to-primary-container text-on-primary shadow-ambient-card">
            <span className="flex items-center gap-sm font-label-caps text-label-caps uppercase tracking-wider">
              <Icon name="savings" filled />
              Shared Savings
            </span>
            <span className="font-numeric-data text-title-md">
              {formatPence(plan.sharedSavings)}
            </span>
          </div>
        )}

        {plan.meals.length === 0 ? (
          <EmptyState
            icon="calendar_month"
            title="Nothing planned yet"
            body="As housemates opt into nights and pick recipes, the week fills in here — and conflicting choices get flagged."
          />
        ) : (
          <PlanGrid plan={plan} housemates={housemates} weekStartDate={plan.weekStartDate} />
        )}
      </section>
    </PageShell>
  );
}
