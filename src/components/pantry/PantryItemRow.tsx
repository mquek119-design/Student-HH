'use client';

import { useTransition } from 'react';
import { Icon } from '@/components/media/Icon';
import { Badge } from '@/components/ui/Badge';
import type { PantryItem } from '@/lib/types';
import { addPantryItemToBasket, markPantryItemUsedUp } from '@/app/pantry/actions';

export function PantryItemRow({ item }: { item: PantryItem }) {
  const [isPending, startTransition] = useTransition();

  function handleMarkUsedUp() {
    startTransition(async () => {
      await markPantryItemUsedUp(item.id);
    });
  }

  function handleAddToBasket() {
    startTransition(async () => {
      await addPantryItemToBasket(item.id);
    });
  }

  return (
    <li className="p-md flex items-center gap-md">
      <div className="flex-grow min-w-0">
        <p className="font-body-lg text-body-lg truncate">{item.name}</p>
        <p className="font-body-sm text-body-sm text-on-surface-variant font-numeric-data">
          {item.quantityRemaining}
          {item.unit === '%' ? '%' : ` ${item.unit}`} left
        </p>
      </div>

      {item.lowStock && (
        <Badge tone="secondary" className="shrink-0">
          Low
        </Badge>
      )}

      <div className="flex items-center gap-xs shrink-0">
        <button
          type="button"
          disabled={isPending}
          title="Mark used up"
          aria-label={`Mark ${item.name} used up`}
          onClick={handleMarkUsedUp}
          className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
        >
          <Icon name="remove_shopping_cart" className="text-[18px]" />
        </button>
        <button
          type="button"
          disabled={isPending}
          title="Add to basket"
          aria-label={`Add ${item.name} to basket`}
          onClick={handleAddToBasket}
          className="w-9 h-9 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
        >
          <Icon name="add_shopping_cart" className="text-[18px]" />
        </button>
      </div>
    </li>
  );
}
