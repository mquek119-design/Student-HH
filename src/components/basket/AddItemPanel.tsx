'use client';

import { useState, useTransition } from 'react';
import { FoodImage } from '@/components/media/FoodImage';
import { Icon } from '@/components/media/Icon';
import { Card } from '@/components/ui/Card';
import { formatPence } from '@/lib/money';
import { parsePackFromTitle } from '@/lib/packParsing';
import { searchTescoProducts } from '@/app/basket/actions';
import { addManualItem } from '@/app/basket/actions';

interface Found {
  product_uid: string;
  name: string;
  price: number;
  size: string;
  imageUrl: string | null;
}

/**
 * Adds something the recipes never asked for.
 *
 * A weekly shop is not only ingredients — washing-up liquid, bin bags, milk for
 * tea. Without this the house needs a second shopping list, which defeats the
 * point of building one basket.
 *
 * Added items are flagged `is_manual` so rebuilding the basket from the plan
 * does not delete them.
 */
export function AddItemPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Found[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function search() {
    if (!query.trim()) return;
    startTransition(async () => {
      setMessage(null);
      const found = await searchTescoProducts(query.trim());
      setResults(found as Found[]);
      if (found.length === 0) setMessage('Nothing came back for that. Try a simpler name.');
    });
  }

  function add(product: Found) {
    startTransition(async () => {
      const data = new FormData();
      data.set('productId', product.product_uid);
      data.set('name', product.name);
      data.set('price', String(product.price));
      data.set('subtitle', packLabel(product.name) ?? product.size ?? '');
      if (product.imageUrl) data.set('imageUrl', product.imageUrl);

      const result = await addManualItem({ status: 'idle', message: '' }, data);
      setMessage(result.message);
      if (result.status !== 'error') {
        setResults([]);
        setQuery('');
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full h-11 rounded-lg border border-dashed border-outline-variant text-on-surface-variant font-semibold flex items-center justify-center gap-sm hover:border-primary hover:text-primary transition-colors"
      >
        <Icon name="add" className="text-[18px]" />
        Add something not in a recipe
      </button>
    );
  }

  return (
    <Card className="flex flex-col gap-sm">
      <div className="flex items-start justify-between gap-md">
        <div className="min-w-0">
          <h2 className="font-title-md text-title-md">Add an item</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Household things the recipes don&apos;t cover. Split equally, and kept when the basket
            is rebuilt.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
        >
          <Icon name="close" className="text-[18px]" />
        </button>
      </div>

      <div className="flex gap-sm">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              search();
            }
          }}
          placeholder="e.g. washing up liquid"
          aria-label="Search Tesco"
          className="flex-1 min-w-0 h-11 px-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-primary text-body-lg"
        />
        <button
          type="button"
          onClick={search}
          disabled={pending || !query.trim()}
          className="px-md h-11 rounded-lg bg-primary text-on-primary font-semibold text-[14px] flex items-center gap-xs hover:opacity-90 transition-opacity disabled:opacity-60 shrink-0"
        >
          <Icon name={pending ? 'progress_activity' : 'search'} className="text-[18px]" />
          Search
        </button>
      </div>

      {results.length > 0 && (
        <ul className="flex flex-col gap-xs max-h-72 overflow-y-auto">
          {results.map((product) => (
            <li key={product.product_uid}>
              <button
                type="button"
                disabled={pending}
                onClick={() => add(product)}
                className="w-full flex items-center gap-md p-sm rounded-lg border border-surface-container-highest hover:border-primary hover:bg-primary/5 transition-colors text-left disabled:opacity-60"
              >
                <FoodImage
                  src={product.imageUrl}
                  seed={product.product_uid}
                  alt={product.name}
                  icon="grocery"
                  className="w-12 h-12 rounded-lg shrink-0 text-[22px] object-contain bg-surface-container-lowest"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-body-sm text-body-sm font-semibold truncate">
                    {product.name}
                  </span>
                  <span className="block font-numeric-data text-[12px] text-on-surface-variant">
                    {packLabel(product.name) ?? product.size}
                  </span>
                </span>
                <span className="font-numeric-data text-numeric-data shrink-0">
                  {formatPence(product.price)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {message && (
        <p role="status" className="font-body-sm text-body-sm text-on-surface-variant">
          {message}
        </p>
      )}
    </Card>
  );
}

/** Pack size read out of the product title — the provider never sets `size`. */
function packLabel(title: string): string | null {
  const pack = parsePackFromTitle(title);
  if (!pack) return null;
  return pack.unit === 'whole' ? `${pack.size} pack` : `${pack.size}${pack.unit}`;
}
