'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useState } from 'react';
import { Icon } from '@/components/media/Icon';
import { Card } from '@/components/ui/Card';
import { createRecipe, type RecipeFormState } from '../actions';
import { parseIngredientLine } from '@/lib/parseIngredient';

const INITIAL: RecipeFormState = { status: 'idle', message: '' };

const FIELD =
  'w-full px-3 py-3 rounded-lg bg-surface-container-lowest border border-surface-container-highest focus:ring-2 focus:ring-primary focus:border-primary text-body-lg';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-12 rounded-lg bg-secondary-container text-on-primary font-title-md text-title-md flex items-center justify-center gap-sm hover:bg-secondary transition-colors disabled:opacity-60"
    >
      <Icon name={pending ? 'progress_activity' : 'save'} />
      {pending ? 'Saving…' : 'Save Recipe'}
    </button>
  );
}

export function RecipeForm() {
  const [state, formAction] = useFormState(createRecipe, INITIAL);
  const [ingredientsText, setIngredientsText] = useState('');

  // Live preview so a mis-parsed line is obvious before saving, not after.
  const lines = ingredientsText.split('\n');
  const parsed = lines.map((line) => ({ line, result: parseIngredientLine(line) }));
  const unparseable = parsed.filter((p) => p.line.trim() && p.result === null);
  const good = parsed.filter((p) => p.result !== null);

  return (
    <form action={formAction} className="flex flex-col gap-md">
      <label className="flex flex-col gap-xs">
        <span className="font-body-sm text-body-sm font-semibold">Title</span>
        <input name="title" required maxLength={120} placeholder="e.g. Creamy Tomato Pasta" className={FIELD} />
      </label>

      <div className="grid grid-cols-2 gap-md">
        <label className="flex flex-col gap-xs">
          <span className="font-body-sm text-body-sm font-semibold">Serves</span>
          <input
            type="number"
            name="servings"
            min={1}
            defaultValue={4}
            className={`${FIELD} font-numeric-data`}
          />
        </label>
        <label className="flex flex-col gap-xs">
          <span className="font-body-sm text-body-sm font-semibold">Cook time (min)</span>
          <input
            type="number"
            name="cookTimeMins"
            min={1}
            defaultValue={30}
            className={`${FIELD} font-numeric-data`}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-md">
        <label className="flex flex-col gap-xs">
          <span className="font-body-sm text-body-sm font-semibold">Cost per portion (£)</span>
          <input
            name="costPerPortion"
            inputMode="decimal"
            placeholder="1.80"
            className={`${FIELD} font-numeric-data`}
          />
          <span className="font-body-sm text-[12px] text-on-surface-variant">
            Optional — leave blank until you know.
          </span>
        </label>
        <label className="flex flex-col gap-xs">
          <span className="font-body-sm text-body-sm font-semibold">Mostly</span>
          <select name="category" defaultValue="cupboard" className={FIELD}>
            <option value="fresh">Fresh</option>
            <option value="cupboard">Cupboard</option>
            <option value="frozen">Frozen</option>
            <option value="household">Household</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-xs">
        <span className="font-body-sm text-body-sm font-semibold">Ingredients</span>
        <span className="font-body-sm text-[12px] text-on-surface-variant">
          One per line, quantity first — <code className="font-numeric-data">500 g Penne pasta</code>
        </span>
        <textarea
          name="ingredients"
          required
          rows={7}
          value={ingredientsText}
          onChange={(event) => setIngredientsText(event.target.value)}
          placeholder={'500 g Penne pasta\n2 tins Chopped tomatoes\n3 cloves Garlic\n1 Lime'}
          className={`${FIELD} resize-y font-numeric-data text-[14px]`}
        />
      </label>

      {(good.length > 0 || unparseable.length > 0) && (
        <Card className="flex flex-col gap-xs">
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
            Understood {good.length} ingredient{good.length === 1 ? '' : 's'}
          </span>
          <ul className="flex flex-col gap-xs">
            {good.map(({ result }, index) => (
              <li
                key={index}
                className="flex items-center justify-between gap-md font-body-sm text-body-sm"
              >
                <span className="truncate">{result!.name}</span>
                <span className="font-numeric-data text-on-surface-variant shrink-0">
                  {result!.quantity} {result!.unit}
                </span>
              </li>
            ))}
          </ul>
          {unparseable.length > 0 && (
            <p className="font-body-sm text-body-sm text-error mt-xs">
              Couldn&apos;t read: {unparseable.map((p) => `"${p.line.trim()}"`).join(', ')} — start
              each line with a number.
            </p>
          )}
        </Card>
      )}

      <label className="flex flex-col gap-xs">
        <span className="font-body-sm text-body-sm font-semibold">Method</span>
        <span className="font-body-sm text-[12px] text-on-surface-variant">One step per line.</span>
        <textarea
          name="instructions"
          rows={6}
          placeholder={'Boil the pasta until al dente.\nSoften the garlic in oil.\nAdd the tomatoes and simmer.'}
          className={`${FIELD} resize-y`}
        />
      </label>

      <label className="flex flex-col gap-xs">
        <span className="font-body-sm text-body-sm font-semibold">Tags</span>
        <input name="tags" placeholder="Vegetarian, 15-min meals" className={FIELD} />
      </label>

      <label className="flex flex-col gap-xs">
        <span className="font-body-sm text-body-sm font-semibold">Source URL</span>
        <input type="url" name="sourceUrl" placeholder="https://…" className={FIELD} />
      </label>

      <label className="flex flex-col gap-xs">
        <span className="font-body-sm text-body-sm font-semibold">Pro tip</span>
        <textarea
          name="proTip"
          rows={2}
          placeholder="The one thing that makes this work."
          className={`${FIELD} resize-y`}
        />
      </label>

      {state.status === 'error' && (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {state.message}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
