'use client';

import { useFormState } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Icon } from '@/components/media/Icon';
import { Card } from '@/components/ui/Card';
import { SubmitButton as FormSubmitButton } from '@/components/ui/SubmitButton';
import { importRecipeFromUrl, type ImportState } from '@/app/recipes/actions';

const INITIAL: ImportState = { status: 'idle', message: '' };

function SubmitButton() {
  return (
    <FormSubmitButton
      variant="secondary"
      icon="download"
      className="rounded-lg shrink-0"
      pendingLabel="Reading…"
    >
      Import
    </FormSubmitButton>
  );
}

/**
 * Imports a recipe from a link.
 *
 * Reads schema.org JSON-LD, which nearly every recipe site publishes, rather
 * than scraping markup that changes with every redesign.
 *
 * The result pre-fills the creation form instead of saving straight away: an
 * import is a starting point, and the house is about to plan meals and split
 * money from these quantities, so someone should see what was understood first
 * — particularly the lines that could not be read.
 */
export function ImportRecipeCard() {
  const [state, action] = useFormState(importRecipeFromUrl, INITIAL);
  const router = useRouter();

  useEffect(() => {
    if (state.status !== 'success' || !state.recipe) return;

    const recipe = state.recipe;
    const params = new URLSearchParams({
      title: recipe.title,
      ingredients: recipe.ingredientLines.join('\n'),
      instructions: recipe.instructions.join('\n'),
      sourceUrl: recipe.sourceUrl,
    });
    if (recipe.servings) params.set('servings', String(recipe.servings));
    if (recipe.cookTimeMins) params.set('cookTimeMins', String(recipe.cookTimeMins));
    if (recipe.unparsed.length > 0) params.set('unparsed', recipe.unparsed.join('\n'));

    router.push(`/recipes/new?${params.toString()}`);
  }, [state, router]);

  return (
    <Card id="import" accent="secondary" className="flex flex-col gap-sm scroll-mt-[88px]">
      <div className="flex items-start gap-sm">
        <Icon name="link" className="text-secondary mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h2 className="font-body-lg text-body-lg font-semibold">Import from a link</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Paste a recipe URL and we&apos;ll read the ingredients and method, then hand them to the
            form for you to check.
          </p>
        </div>
      </div>

      <form action={action} className="flex gap-sm">
        <input
          type="url"
          name="url"
          required
          placeholder="https://…"
          aria-label="Recipe URL"
          className="flex-1 min-w-0 h-11 px-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-primary text-body-sm"
        />
        <SubmitButton />
      </form>

      {state.status === 'error' && (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {state.message}
        </p>
      )}
      {state.status === 'success' && (
        <p role="status" className="font-body-sm text-body-sm text-primary">
          {state.message} Opening the form…
        </p>
      )}
    </Card>
  );
}
