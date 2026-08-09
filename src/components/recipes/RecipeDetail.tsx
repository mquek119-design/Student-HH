'use client';

import { useState } from 'react';
import { Icon } from '@/components/media/Icon';
import { Card } from '@/components/ui/Card';
import { clsx } from '@/lib/clsx';
import { formatPence } from '@/lib/money';
import type { Recipe } from '@/lib/types';

/**
 * Recipe detail with Cook Mode.
 *
 * Cook Mode enlarges the steps and keeps the screen awake — you are reading
 * this from across a kitchen with wet hands.
 */
export function RecipeDetail({ recipe }: { recipe: Recipe }) {
  const [servings, setServings] = useState(recipe.servings);
  const [cookMode, setCookMode] = useState(false);
  const [done, setDone] = useState<Set<number>>(new Set());

  const scale = servings / recipe.servings;
  const missing = recipe.ingredients.filter((ingredient) => !ingredient.inPantry);

  function toggleStep(index: number) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between gap-md">
        <div className="flex items-center gap-md flex-wrap">
          <span className="flex items-center gap-xs font-body-sm text-body-sm text-on-surface-variant">
            <Icon name="schedule" className="text-[18px]" />
            {recipe.cookTimeMins} min
          </span>
          <span className="flex items-center gap-xs font-body-sm text-body-sm text-on-surface-variant capitalize">
            <Icon name="signal_cellular_alt" className="text-[18px]" />
            {recipe.difficulty}
          </span>
          <span className="flex items-center gap-xs font-numeric-data text-numeric-data text-primary">
            <Icon name="payments" className="text-[18px]" />
            {formatPence(recipe.costPerPortion)}/portion
          </span>
        </div>

        <label className="flex items-center gap-sm cursor-pointer shrink-0">
          <span className="font-body-sm text-body-sm text-on-surface-variant">Cook Mode</span>
          <span className="relative inline-flex items-center">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={cookMode}
              onChange={(event) => setCookMode(event.target.checked)}
            />
            <span className="w-11 h-6 bg-surface-container-highest rounded-full peer peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
          </span>
        </label>
      </div>

      <div className={clsx('grid gap-lg', cookMode ? 'grid-cols-1' : 'lg:grid-cols-12')}>
        <div className={clsx('flex flex-col gap-md', !cookMode && 'lg:col-span-5 lg:order-2')}>
          <Card className="flex flex-col gap-md">
            <div className="flex items-center justify-between gap-sm">
              <h2 className="font-title-md text-title-md">Ingredients</h2>
              <div className="flex items-center gap-2 bg-surface-container rounded-lg p-1">
                <button
                  type="button"
                  aria-label="Fewer servings"
                  onClick={() => setServings((prev) => Math.max(1, prev - 1))}
                  className="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest rounded"
                >
                  <Icon name="remove" className="text-[16px]" />
                </button>
                <span className="font-numeric-data text-numeric-data w-12 text-center tabular-nums">
                  {servings}
                </span>
                <button
                  type="button"
                  aria-label="More servings"
                  onClick={() => setServings((prev) => prev + 1)}
                  className="w-6 h-6 flex items-center justify-center text-primary hover:bg-primary-container hover:text-on-primary-container rounded"
                >
                  <Icon name="add" className="text-[16px]" />
                </button>
              </div>
            </div>

            <ul className="flex flex-col divide-y divide-surface-container-highest">
              {recipe.ingredients.map((ingredient) => {
                const scaled = ingredient.quantity * scale;
                const display = scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(1);
                return (
                  <li
                    key={ingredient.ingredientId}
                    className="py-sm flex items-center justify-between gap-md"
                  >
                    <span className="flex items-center gap-sm min-w-0">
                      <Icon
                        name={ingredient.inPantry ? 'check_circle' : 'radio_button_unchecked'}
                        filled={ingredient.inPantry}
                        className={clsx(
                          'text-[18px] shrink-0',
                          ingredient.inPantry ? 'text-primary' : 'text-outline-variant'
                        )}
                      />
                      <span className="font-body-lg text-body-lg truncate">{ingredient.name}</span>
                    </span>
                    <span className="font-numeric-data text-numeric-data text-on-surface-variant shrink-0">
                      {display} {ingredient.unit}
                    </span>
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              disabled={missing.length === 0}
              className="w-full h-12 rounded-lg bg-secondary-container text-on-primary font-title-md text-title-md flex items-center justify-center gap-sm hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon name="add_shopping_cart" />
              {missing.length === 0
                ? 'Everything in the pantry'
                : `Add ${missing.length} Missing to Basket`}
            </button>
          </Card>
        </div>

        <div className={clsx('flex flex-col gap-md', !cookMode && 'lg:col-span-7 lg:order-1')}>
          <h2 className="font-title-md text-title-md">Method</h2>
          <ol className="flex flex-col gap-sm">
            {recipe.instructions.map((step, index) => {
              const isDone = done.has(index);
              return (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => toggleStep(index)}
                    className={clsx(
                      'w-full text-left flex items-start gap-md p-md rounded-xl border transition-colors',
                      isDone
                        ? 'bg-primary/5 border-primary/30'
                        : 'bg-surface-container-lowest border-surface-container-highest hover:border-outline-variant'
                    )}
                  >
                    <span
                      className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-numeric-data',
                        isDone
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container text-on-surface-variant'
                      )}
                    >
                      {isDone ? <Icon name="check" className="text-[18px]" /> : index + 1}
                    </span>
                    <span
                      className={clsx(
                        cookMode ? 'text-[20px] leading-8' : 'text-body-lg',
                        isDone && 'line-through text-on-surface-variant'
                      )}
                    >
                      {step}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {recipe.proTip && (
            <Card accent="secondary" className="flex items-start gap-sm">
              <Icon name="lightbulb" filled className="text-secondary mt-0.5" />
              <div>
                <h3 className="font-numeric-data text-numeric-data mb-1">Pro Tip</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{recipe.proTip}</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
