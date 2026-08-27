import { redirect } from 'next/navigation';
import { LeftoversGrid } from '@/components/leftovers/LeftoversGrid';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { getCurrentUser, getHousemates, getWeeklyPlan } from '@/lib/queries';
import { weekRangeLabel } from '@/lib/weeks';

export const metadata = { title: 'Leftovers · Grub' };
export const dynamic = 'force-dynamic';

export default async function LeftoversPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser.houseId) redirect('/onboarding');

  const [plan, housemates] = await Promise.all([getWeeklyPlan(), getHousemates()]);
  if (!plan) redirect('/onboarding');

  // Find all meals with status 'cooked' in this week's plan
  const cookedMeals = plan.meals.filter((meal) => meal.status === 'cooked');

  // Create a map of user id to user for quick lookup
  const usersById = new Map(housemates.map((user) => [user.id, user]));

  const weekRange = weekRangeLabel(plan.weekStartDate);

  return (
    <PageShell>
      <PageHeader
        title="This Week's Leftovers"
        subtitle={weekRange}
      />

      {cookedMeals.length === 0 ? (
        <EmptyState
          icon="ti-plate"
          title="No meals cooked yet"
          body="Once someone cooks, their leftovers will show up here."
        />
      ) : (
        <LeftoversGrid meals={cookedMeals} recipes={plan.recipes} usersById={usersById} />
      )}
    </PageShell>
  );
}
