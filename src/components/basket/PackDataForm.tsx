'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Icon } from '@/components/media/Icon';
import { Card } from '@/components/ui/Card';
import { saveIngredientPack, type BasketActionState } from '@/app/basket/actions';

const INITIAL: BasketActionState = { status: 'idle', message: '' };

const FIELD =
  'h-11 px-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-primary text-body-lg font-numeric-data w-full';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 px-md rounded-lg bg-primary text-on-primary font-semibold text-[14px] flex items-center justify-center gap-xs hover:opacity-90 transition-opacity disabled:opacity-60 shrink-0"
    >
      <Icon name={pending ? 'progress_activity' : 'check'} className="text-[18px]" />
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

/**
 * Collects pack size, unit and price for one ingredient.
 *
 * Without this the optimiser knows the house needs 900g of pasta but not what a
 * pack holds or costs, so the line cannot be priced or split. Recorded once per
 * ingredient and reused every week; saving re-runs the optimiser immediately.
 */
export function PackDataForm({
  ingredientId,
  name,
  suggestedUnit,
}: {
  ingredientId: string;
  name: string;
  suggestedUnit: string;
}) {
  const [state, formAction] = useFormState(saveIngredientPack, INITIAL);

  return (
    <Card accent="secondary" className="flex flex-col gap-sm">
      <div className="flex items-start gap-sm">
        <Icon name="help" className="text-secondary mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h3 className="font-body-lg text-body-lg font-semibold truncate">{name}</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            What does one pack contain, and what does it cost? Needed before this can be priced or
            split.
          </p>
        </div>
      </div>

      <form action={formAction} className="flex flex-wrap items-end gap-sm">
        <input type="hidden" name="ingredientId" value={ingredientId} />

        <label className="flex flex-col gap-xs flex-1 min-w-[88px]">
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
            Pack size
          </span>
          <input name="packSize" inputMode="decimal" placeholder="500" required className={FIELD} />
        </label>

        <label className="flex flex-col gap-xs flex-1 min-w-[80px]">
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
            Unit
          </span>
          <input
            name="packUnit"
            defaultValue={suggestedUnit}
            placeholder="g"
            required
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-xs flex-1 min-w-[88px]">
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
            Price (£)
          </span>
          <input name="packPrice" inputMode="decimal" placeholder="1.20" required className={FIELD} />
        </label>

        <SaveButton />
      </form>

      {state.status === 'error' && (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {state.message}
        </p>
      )}
    </Card>
  );
}
