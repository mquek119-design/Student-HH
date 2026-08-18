import Link from 'next/link';
import { Icon } from '@/components/media/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { RecipeForm } from './RecipeForm';

export const metadata = { title: 'Add a Recipe · Grub' };

export default function NewRecipePage({
  searchParams,
}: {
  // Populated by the importer, which hands the parsed recipe over rather than
  // saving it — the house plans and splits money from these quantities, so a
  // person should see them first.
  searchParams: Record<string, string | undefined>;
}) {
  const prefill = {
    title: searchParams.title,
    ingredients: searchParams.ingredients,
    instructions: searchParams.instructions,
    sourceUrl: searchParams.sourceUrl,
    servings: searchParams.servings ? Number(searchParams.servings) : undefined,
    cookTimeMins: searchParams.cookTimeMins ? Number(searchParams.cookTimeMins) : undefined,
    unparsed: searchParams.unparsed
      ? searchParams.unparsed.split(/\r?\n/).filter(Boolean)
      : undefined,
  };

  return (
    <PageShell>
      <Link
        href="/recipes"
        className="flex items-center gap-xs text-primary font-semibold text-[14px] hover:opacity-80 w-fit"
      >
        <Icon name="arrow_back" className="text-[18px]" />
        Recipes
      </Link>

      <PageHeader
        title="Add a recipe"
        subtitle={
          searchParams.title
            ? "Imported. Check the quantities before saving — the shop is built from them."
            : "Ingredients drive the shop, so those matter most — the method is for whoever cooks."
        }
      />

      <RecipeForm prefill={prefill} />
    </PageShell>
  );
}
