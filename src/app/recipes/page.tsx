import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RecipeCard, pantryMatchCount } from '@/components/cards/RecipeCard';
import { Icon } from '@/components/media/Icon';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { getCurrentUser, getPantryItems, getRecipes } from '@/lib/queries';

export const metadata = { title: 'Recipes · HouseGrocer' };
export const dynamic = 'force-dynamic';

/**
 * Recipes Hub. Reached from the Plan tab's search/add flow rather than its own
 * bottom-nav tab, so it keeps Plan highlighted while you are in here.
 */
export default async function RecipesPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser.houseId) redirect('/onboarding');

  const [recipes, pantry] = await Promise.all([getRecipes(), getPantryItems()]);

  const withMatches = recipes
    .map((recipe) => ({ recipe, matches: pantryMatchCount(recipe, pantry) }))
    .sort((a, b) => b.matches - a.matches);

  const pantryMatches = withMatches.filter((entry) => entry.matches >= 2);
  const quick = recipes.filter((recipe) => recipe.cookTimeMins <= 20);
  const favourites = recipes.filter((recipe) => recipe.tags.includes('House Favourite'));

  return (
    <PageShell>
      <PageHeader
        title="Recipes"
        subtitle="Everything the house has saved, plus what your pantry already covers."
        action={
          <Link
            href="/recipes/new"
            className="flex items-center gap-xs px-md py-sm rounded-full bg-primary text-on-primary font-semibold text-[14px] hover:opacity-90 transition-opacity shrink-0"
          >
            <Icon name="add" className="text-[18px]" />
            Add
          </Link>
        }
      />

      {recipes.length === 0 ? (
        <EmptyState
          icon="menu_book"
          title="No recipes yet"
          body="Add the meals your house actually cooks. Their ingredients are what the weekly shop is built from."
          action={{ href: '/recipes/new', label: 'Add your first recipe' }}
        />
      ) : (
        <>
          {pantryMatches.length > 0 && (
            <section className="flex flex-col gap-sm">
              <h2 className="font-title-md text-title-md flex items-center gap-sm">
                <Icon name="kitchen" className="text-primary" />
                Pantry Match
              </h2>
              <div className="flex flex-col gap-sm">
                {pantryMatches.map(({ recipe, matches }) => (
                  <RecipeCard key={recipe.id} recipe={recipe} pantryMatchCount={matches} />
                ))}
              </div>
            </section>
          )}

          {favourites.length > 0 && (
            <section className="flex flex-col gap-sm">
              <h2 className="font-title-md text-title-md flex items-center gap-sm">
                <Icon name="favorite" className="text-secondary" filled />
                House Favourites
              </h2>
              <div className="flex flex-col gap-sm">
                {favourites.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} />
                ))}
              </div>
            </section>
          )}

          {quick.length > 0 && (
            <section className="flex flex-col gap-sm">
              <h2 className="font-title-md text-title-md flex items-center gap-sm">
                <Icon name="bolt" className="text-secondary" />
                20 Minutes or Less
              </h2>
              <div className="flex flex-col gap-sm">
                {quick.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} />
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-sm">
            <h2 className="font-title-md text-title-md">All Recipes</h2>
            <div className="flex flex-col gap-sm">
              {recipes.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          </section>
        </>
      )}

      <Card accent="secondary" className="flex items-start gap-sm">
        <Icon name="link" className="text-secondary mt-0.5" />
        <div className="flex-grow min-w-0">
          <h2 className="font-body-lg text-body-lg font-semibold">Import from a link</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Pasting a YouTube, Instagram or blog URL to pull ingredients automatically isn&apos;t
            built yet. For now, add recipes by hand.
          </p>
        </div>
      </Card>
    </PageShell>
  );
}
