'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@/components/media/Icon';
import { Card } from '@/components/ui/Card';
import { deleteRecipe } from '@/app/recipes/actions';

/** Deleting a recipe. Confirms first, and reports the refusal when it is planned. */
export function DeleteRecipeButton({ recipeId, title }: { recipeId: string; title: string }) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteRecipe(recipeId);
      // Success redirects, so anything returned here is a refusal.
      if (result?.status === 'error') {
        setMessage(result.message);
        setConfirming(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-sm border-t border-surface-container-highest pt-md">
      {confirming ? (
        <Card accent="error" className="flex flex-col gap-sm">
          <p className="font-body-sm text-body-sm">
            Delete <strong>{title}</strong>? Past baskets and splits keep their own copies of what
            was bought, so history is unaffected.
          </p>
          <div className="flex gap-sm">
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className="flex-1 h-11 rounded-lg bg-error text-on-error font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {pending ? 'Deleting…' : 'Delete'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 h-11 rounded-lg border border-outline-variant text-on-surface-variant font-semibold hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
          </div>
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="self-start flex items-center gap-xs text-error font-semibold text-[14px] hover:opacity-80"
        >
          <Icon name="delete" className="text-[18px]" />
          Delete this recipe
        </button>
      )}

      {message && (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {message}
        </p>
      )}
    </div>
  );
}
