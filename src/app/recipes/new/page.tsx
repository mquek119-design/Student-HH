import Link from 'next/link';
import { Icon } from '@/components/media/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { RecipeForm } from './RecipeForm';

export const metadata = { title: 'Add a Recipe · HouseGrocer' };

export default function NewRecipePage() {
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
        subtitle="Ingredients drive the shop, so those matter most — the method is for whoever cooks."
      />

      <RecipeForm />
    </PageShell>
  );
}
