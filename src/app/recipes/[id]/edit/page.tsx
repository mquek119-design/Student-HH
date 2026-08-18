import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/media/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { RecipeForm } from '../../new/RecipeForm';
import { DeleteRecipeButton } from '@/components/recipes/DeleteRecipeButton';
import { getRecipe } from '@/lib/queries';
import { formatPenceBare } from '@/lib/money';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Edit Recipe · Grub' };

export default async function EditRecipePage({ params }: { params: { id: string } }) {
  const recipe = await getRecipe(params.id);
  if (!recipe) notFound();

  return (
    <PageShell>
      <Link
        href={`/recipes/${recipe.id}`}
        className="flex items-center gap-xs text-primary font-semibold text-[14px] hover:opacity-80 w-fit"
      >
        <Icon name="arrow_back" className="text-[18px]" />
        Back to recipe
      </Link>

      <PageHeader
        title="Edit recipe"
        subtitle="Changing ingredients changes the shop — rebuild the basket afterwards."
      />

      <RecipeForm
        prefill={{
          recipeId: recipe.id,
          title: recipe.title,
          servings: recipe.servings,
          cookTimeMins: recipe.cookTimeMins,
          costPerPortion: recipe.costPerPortion > 0 ? formatPenceBare(recipe.costPerPortion) : '',
          // Rendered in the same syntax the form parses, so a round trip
          // through edit cannot quietly change quantities.
          ingredients: recipe.ingredients
            .map((item) => `${item.quantity} ${item.unit} ${item.name}`)
            .join('\n'),
          instructions: recipe.instructions.join('\n'),
          tags: recipe.tags.join(', '),
          sourceUrl: recipe.sourceUrl ?? '',
          proTip: recipe.proTip ?? '',
        }}
      />

      <DeleteRecipeButton recipeId={recipe.id} title={recipe.title} />
    </PageShell>
  );
}
