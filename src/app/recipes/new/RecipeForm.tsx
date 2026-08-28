'use client';

import { useActionState } from 'react';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { SubmitButton as FormSubmitButton } from '@/components/ui/SubmitButton';
import { createRecipe, updateRecipe, type RecipeFormState } from '../actions';
import { parseIngredientLine, type ParsedIngredient } from '@/lib/parseIngredient';
import { IngredientAutocomplete } from '@/components/recipes/IngredientAutocomplete';

const INITIAL: RecipeFormState = { status: 'idle', message: '' };

const FIELD =
  'w-full px-3 py-3 rounded-lg bg-surface-container-lowest border border-surface-container-highest focus:ring-2 focus:ring-primary focus:border-primary text-body-lg';

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  return (
    <FormSubmitButton
      variant="secondary"
      size="lg"
      fullWidth
      icon="save"
      pendingLabel="Saving…"
      disabled={disabled}
    >
      {label}
    </FormSubmitButton>
  );
}

export interface RecipePrefill {
  recipeId?: string;
  title?: string;
  servings?: number;
  cookTimeMins?: number;
  costPerPortion?: string;
  ingredients?: string;
  instructions?: string;
  tags?: string;
  sourceUrl?: string;
  proTip?: string;
  /** Imported lines the parser could not read — shown so they aren't lost. */
  unparsed?: string[];
}

export function RecipeForm({ prefill }: { prefill?: RecipePrefill }) {
  // Editing reuses the same form: the fields are identical, and keeping one
  // component means a change to the ingredient syntax cannot drift between
  // creating and editing.
  const isEdit = Boolean(prefill?.recipeId);
  const [state, formAction] = useActionState(isEdit ? updateRecipe : createRecipe, INITIAL);
  const [title, setTitle] = useState(prefill?.title ?? '');
  const [servings, setServings] = useState(prefill?.servings?.toString() ?? '4');
  const [cookTime, setCookTime] = useState(prefill?.cookTimeMins?.toString() ?? '30');
  const [costPerPortion, setCostPerPortion] = useState(prefill?.costPerPortion ?? '');
  const [category, setCategory] = useState('cupboard');
  const [ingredientsText, setIngredientsText] = useState(prefill?.ingredients ?? '');
  const [instructions, setInstructions] = useState(prefill?.instructions ?? '');
  const [tags, setTags] = useState(prefill?.tags ?? '');
  const [sourceUrl, setSourceUrl] = useState(prefill?.sourceUrl ?? '');
  const [proTip, setProTip] = useState(prefill?.proTip ?? '');
  const [validationErrors, setValidationErrors] = useState<{ servings?: string; cookTime?: string }>({});

  // Live preview so a mis-parsed line is obvious before saving, not after.
  const lines = ingredientsText.split('\n');
  const parsed = lines.map((line) => ({ line, result: parseIngredientLine(line) }));
  const unparseable = parsed.filter((p) => p.line.trim() && p.result === null);
  const good = parsed.filter((p) => p.result !== null);

  // Add ingredient from autocomplete to the textarea
  const handleAddIngredient = (ingredient: ParsedIngredient & { ingredientId?: string }) => {
    const line = `${ingredient.quantity} ${ingredient.unit} ${ingredient.name}`;
    setIngredientsText((prev) => (prev ? `${prev}\n${line}` : line));
  };

  // Validate a single field and return error message if invalid
  const validateField = (field: 'servings' | 'cookTime', value: string): string | undefined => {
    const num = parseInt(value, 10);

    if (field === 'servings') {
      if (!num || num < 1) {
        return 'Needs at least 1';
      }
      if (num > 20) {
        return 'Maximum 20 servings';
      }
    }

    if (field === 'cookTime') {
      if (!num || num < 5) {
        return 'Needs at least 5 minutes';
      }
    }

    return undefined;
  };

  // Check if form is valid
  const isFormValid = () => {
    const servingsError = validateField('servings', servings);
    const cookTimeError = validateField('cookTime', cookTime);
    return !servingsError && !cookTimeError;
  };

  // Real-time validation on field change
  const handleServingsChange = (value: string) => {
    setServings(value);
    const error = validateField('servings', value);
    setValidationErrors((prev) => {
      if (error) {
        return { ...prev, servings: error };
      }
      const { servings: _, ...rest } = prev;
      return rest;
    });
  };

  const handleCookTimeChange = (value: string) => {
    setCookTime(value);
    const error = validateField('cookTime', value);
    setValidationErrors((prev) => {
      if (error) {
        return { ...prev, cookTime: error };
      }
      const { cookTime: _, ...rest } = prev;
      return rest;
    });
  };

  // Validate on submit (safety check)
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!isFormValid()) {
      e.preventDefault();
      return;
    }
  };

  return (
    <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-md">
      {prefill?.recipeId && <input type="hidden" name="recipeId" value={prefill.recipeId} />}

      {prefill?.unparsed && prefill.unparsed.length > 0 && (
        <Card accent="secondary" className="flex flex-col gap-xs">
          <span className="font-body-sm text-body-sm font-semibold">
            {prefill.unparsed.length} imported line
            {prefill.unparsed.length === 1 ? '' : 's'} had no readable quantity
          </span>
          <ul className="font-body-sm text-[12px] text-on-surface-variant list-disc pl-md">
            {prefill.unparsed.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <span className="font-body-sm text-[12px] text-on-surface-variant">
            Add them above with a quantity, e.g. &ldquo;1 tsp Salt&rdquo;, or leave them out.
          </span>
        </Card>
      )}
      <label className="flex flex-col gap-xs">
        <span className="font-body-sm text-body-sm font-semibold">Title</span>
        <input
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={120}
          placeholder="e.g. Creamy Tomato Pasta"
          className={FIELD}
        />
      </label>

      <div className="grid grid-cols-2 gap-md">
        <label className="flex flex-col gap-xs">
          <span className="font-body-sm text-body-sm font-semibold">Serves</span>
          <input
            type="number"
            name="servings"
            min={1}
            max={20}
            value={servings}
            onChange={(e) => handleServingsChange(e.target.value)}
            className={`${FIELD} font-numeric-data`}
          />
          {validationErrors.servings && (
            <p className="font-body-sm text-[12px] text-error">{validationErrors.servings}</p>
          )}
        </label>
        <label className="flex flex-col gap-xs">
          <span className="font-body-sm text-body-sm font-semibold">Cook time (min)</span>
          <input
            type="number"
            name="cookTimeMins"
            min={5}
            value={cookTime}
            onChange={(e) => handleCookTimeChange(e.target.value)}
            className={`${FIELD} font-numeric-data`}
          />
          {validationErrors.cookTime && (
            <p className="font-body-sm text-[12px] text-error">{validationErrors.cookTime}</p>
          )}
        </label>
      </div>

      <div className="grid grid-cols-2 gap-md">
        <label className="flex flex-col gap-xs">
          <span className="font-body-sm text-body-sm font-semibold">Cost per portion (£)</span>
          <input
            name="costPerPortion"
            value={costPerPortion}
            onChange={(e) => setCostPerPortion(e.target.value)}
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
          <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={FIELD}>
            <option value="fresh">Fresh</option>
            <option value="cupboard">Cupboard</option>
            <option value="frozen">Frozen</option>
            <option value="household">Household</option>
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-md">
        <IngredientAutocomplete onAdd={handleAddIngredient} />

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
      </div>

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
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={6}
          placeholder={'Boil the pasta until al dente.\nSoften the garlic in oil.\nAdd the tomatoes and simmer.'}
          className={`${FIELD} resize-y`}
        />
      </label>

      <label className="flex flex-col gap-xs">
        <span className="font-body-sm text-body-sm font-semibold">Tags</span>
        <input
          name="tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Vegetarian, 15-min meals"
          className={FIELD}
        />
      </label>

      <label className="flex flex-col gap-xs">
        <span className="font-body-sm text-body-sm font-semibold">Source URL</span>
        <input
          type="url"
          name="sourceUrl"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://…"
          className={FIELD}
        />
      </label>

      <label className="flex flex-col gap-xs">
        <span className="font-body-sm text-body-sm font-semibold">Pro tip</span>
        <textarea
          name="proTip"
          value={proTip}
          onChange={(e) => setProTip(e.target.value)}
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

      <SubmitButton label={isEdit ? 'Save changes' : 'Save Recipe'} disabled={!isFormValid()} />
    </form>
  );
}
