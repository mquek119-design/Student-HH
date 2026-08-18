'use client';

import { useFormState } from 'react-dom';
import { useState } from 'react';
import { Icon } from '@/components/media/Icon';
import { Card } from '@/components/ui/Card';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { addPantryItem, type PantryActionState } from '@/app/pantry/actions';

const INITIAL: PantryActionState = { status: 'idle', message: '' };

const FIELD =
  'h-11 px-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-primary text-body-lg w-full';

/**
 * Records something already in the house.
 *
 * The pantry is what stops the basket buying what you already have, so it needs
 * a way in beyond the seeder — otherwise the subtraction step never fires for a
 * real household and the optimiser overbuys every week.
 */
export function AddPantryItem() {
  const [state, action] = useFormState(addPantryItem, INITIAL);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full h-11 rounded-lg border border-dashed border-outline-variant text-on-surface-variant font-semibold flex items-center justify-center gap-sm hover:border-primary hover:text-primary transition-colors"
      >
        <Icon name="add" className="text-[18px]" />
        Add something you already have
      </button>
    );
  }

  return (
    <Card className="flex flex-col gap-sm">
      <div className="flex items-start justify-between gap-md">
        <div className="min-w-0">
          <h2 className="font-title-md text-title-md">Add to the pantry</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Anything here is subtracted from the shop, so the basket stops buying it twice.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
        >
          <Icon name="close" className="text-[18px]" />
        </button>
      </div>

      <form action={action} className="flex flex-col gap-sm">
        <label className="flex flex-col gap-xs">
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
            Item
          </span>
          <input name="name" required placeholder="e.g. Penne pasta" className={FIELD} />
          <span className="font-body-sm text-[12px] text-on-surface-variant">
            Use the same name your recipes use, or it won&apos;t be matched against them.
          </span>
        </label>

        <div className="flex items-end gap-sm">
          <label className="flex flex-col gap-xs flex-1 min-w-0">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              Quantity
            </span>
            <input
              name="quantity"
              inputMode="decimal"
              required
              placeholder="500"
              className={`${FIELD} font-numeric-data`}
            />
          </label>
          <label className="flex flex-col gap-xs flex-1 min-w-0">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              Unit
            </span>
            <input name="unit" defaultValue="g" className={`${FIELD} font-numeric-data`} />
          </label>
          <SubmitButton icon="add" className="rounded-lg shrink-0" pendingLabel="Adding…">
            Add
          </SubmitButton>
        </div>

        <label className="flex items-center gap-sm">
          <input type="checkbox" name="isShared" value="true" defaultChecked className="w-4 h-4" />
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Shared with the house (uncheck if it&apos;s only yours)
          </span>
        </label>

        {state.status !== 'idle' && (
          <p
            role="status"
            className={`font-body-sm text-body-sm ${
              state.status === 'error' ? 'text-error' : 'text-primary'
            }`}
          >
            {state.message}
          </p>
        )}
      </form>
    </Card>
  );
}
