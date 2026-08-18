import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FoodImage } from '@/components/media/FoodImage';
import { Icon } from '@/components/media/Icon';
import { RecipeDetail } from '@/components/recipes/RecipeDetail';
import { Badge } from '@/components/ui/Badge';
import { PageShell } from '@/components/ui/PageShell';
import { getRecipe } from '@/lib/queries';

// Recipes are per-house and behind auth, so there is nothing to prerender —
// generateStaticParams would run without a session at build time.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }) {
  const recipe = await getRecipe(params.id);
  return { title: recipe ? `${recipe.title} · Grub` : 'Recipe · Grub' };
}

export default async function RecipePage({ params }: { params: { id: string } }) {
  const recipe = await getRecipe(params.id);
  if (!recipe) notFound();

  return (
    <PageShell>
      <Link
        href="/recipes"
        className="flex items-center gap-xs text-primary font-semibold text-[14px] hover:opacity-80 w-fit"
      >
        <Icon name="arrow_back" className="text-[18px]" />
        All recipes
      </Link>

      <FoodImage
        seed={recipe.id}
        alt={recipe.title}
        src={recipe.imageUrl}
        className="w-full h-48 md:h-64 rounded-xl text-[64px]"
      />

      <div className="flex items-start justify-between gap-sm flex-wrap">
        <div className="flex flex-col gap-xs min-w-0">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg">
            {recipe.title}
          </h1>
          <div className="flex flex-wrap gap-xs">
            {recipe.tags.map((tag) => (
              <Badge key={tag} tone="primary">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        <Link
          href={`/recipes/${recipe.id}/edit`}
          className="shrink-0 px-md py-3 rounded-full border border-outline-variant text-on-surface-variant font-semibold hover:border-primary hover:text-primary transition-colors"
        >
          Edit
        </Link>
        <Link
          href="/plan#roster"
          className="shrink-0 px-lg py-3 rounded-full bg-primary text-on-primary font-semibold hover:opacity-90 transition-opacity"
        >
          Plan
        </Link>
      </div>

      <RecipeDetail recipe={recipe} />
    </PageShell>
  );
}
