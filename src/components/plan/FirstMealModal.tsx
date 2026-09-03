'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { useState } from 'react';
import { Icon } from '@/components/media/Icon';
import { FoodImage } from '@/components/media/FoodImage';
import { Reveal } from '@/components/motion/Reveal';
import { addMealToPlan, type PlanActionState } from '@/app/plan/actions';
import type { Recipe } from '@/lib/types';

const INITIAL: PlanActionState = { status: 'idle', message: '' };

interface FirstMealModalProps {
  recipes: Recipe[];
}

/**
 * First-meal nudge shown on empty plan. Guides new houses to add their first meal
 * with popular starter recipes, one-tap to Monday dinner.
 *
 * Dismissible but not closeable by clicking outside — modal backdrop catches that.
 */
export function FirstMealModal({ recipes }: FirstMealModalProps) {
  const [dismissed, setDismissed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (dismissed) return null;
  if (recipes.length === 0) return null;

  // Show only the first 5 recipes
  const shown = recipes.slice(0, 5);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-meal-title"
        className="fixed inset-x-0 bottom-0 z-50 flex items-end justify-center"
      >
        <div className="w-full max-w-md rounded-t-xl bg-surface-0 p-md shadow-lg animate-fade-in-up">
          <Reveal>
            <div className="flex flex-col gap-md">
              {/* Header */}
              <div className="flex flex-col gap-xs">
                <h2 id="first-meal-title" className="font-title-lg text-title-lg text-on-surface">
                  Add your first meal
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Start with one of these. You can add more later.
                </p>
              </div>

              {/* Recipe cards */}
              <div className="flex flex-col gap-sm max-h-96 overflow-y-auto">
                {shown.map((recipe, i) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    isSelected={selectedId === recipe.id}
                    onSelect={() => setSelectedId(recipe.id)}
                    style={{ animationDelay: `${i * 50}ms` }}
                  />
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-sm pt-sm">
                {selectedId && (
                  <AddMealButton
                    recipeId={selectedId}
                  />
                )}
                <button
                  onClick={() => {
                    setDismissed(true);
                  }}
                  className="flex-1 h-12 px-lg rounded-full border border-outline text-on-surface-variant font-semibold hover:bg-surface-container-lowest transition-colors"
                >
                  {selectedId ? 'Skip for now' : 'Skip'}
                </button>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </>
  );
}

interface RecipeCardProps {
  recipe: Recipe;
  isSelected: boolean;
  onSelect: () => void;
  style?: React.CSSProperties;
}

function RecipeCard({ recipe, isSelected, onSelect, style }: RecipeCardProps) {
  return (
    <button
      onClick={onSelect}
      style={style}
      className="animate-fade-in-up"
    >
      <div
        className={`flex items-center gap-md p-sm rounded-lg border-2 transition-all ${
          isSelected
            ? 'border-primary bg-primary-container'
            : 'border-surface-container-highest bg-surface-container-lowest hover:border-primary/50'
        }`}
      >
        {/* Image */}
        <FoodImage
          alt={recipe.title}
          seed={recipe.id}
          className="w-16 h-16 shrink-0 rounded-md"
        />

        {/* Content */}
        <div className="flex-1 text-left min-w-0">
          <h3 className="font-semibold text-on-surface text-sm truncate">{recipe.title}</h3>
          <div className="flex items-center gap-xs text-on-surface-variant text-xs mt-xs">
            <Icon name="schedule" className="text-sm" />
            <span>{recipe.cookTimeMins} mins</span>
          </div>
        </div>

        {/* Checkmark */}
        {isSelected && (
          <div className="shrink-0 w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center">
            <Icon name="check" className="text-base" />
          </div>
        )}
      </div>
    </button>
  );
}

interface AddMealButtonProps {
  recipeId: string;
}

function AddMealButton({ recipeId }: AddMealButtonProps) {
  const [_state, formAction] = useActionState(addMealToPlan, INITIAL);

  return (
    <form
      action={formAction}
      className="flex-1"
    >
      <input type="hidden" name="recipeId" value={recipeId} />
      <input type="hidden" name="day" value="mon" />
      <input type="hidden" name="mealType" value="dinner" />
      <input type="hidden" name="week" value="this" />
      <AddButton />
    </form>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 h-12 px-lg rounded-full bg-secondary text-on-secondary font-semibold hover:opacity-95 disabled:opacity-60 transition-opacity flex items-center justify-center gap-sm"
    >
      {pending && <Icon name="progress_activity" className="animate-spin text-lg" />}
      <span>{pending ? 'Adding...' : 'Add to Monday'}</span>
    </button>
  );
}
