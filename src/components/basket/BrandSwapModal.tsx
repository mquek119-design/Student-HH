'use client';

import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/media/Icon';
import { formatPence } from '@/lib/money';
import { searchTescoProducts, updateIngredientProductMapping } from '@/app/basket/actions';
import { FoodImage } from '@/components/media/FoodImage';
import { parsePackFromTitle } from '@/lib/packParsing';

interface BrandSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  basketItemId: string;
  ingredientId: string | null;
  itemName: string;
}

/** Pack size read out of the product title, e.g. "500g" or "6 pack". */
function packLabel(title: string): string | null {
  const pack = parsePackFromTitle(title);
  if (!pack) return null;
  return pack.unit === 'whole' ? `${pack.size} pack` : `${pack.size}${pack.unit}`;
}

export function BrandSwapModal({ isOpen, onClose, basketItemId, ingredientId, itemName }: BrandSwapModalProps) {
  // Deliberately empty. Pre-filling with the current product name meant the
  // first search returned the thing you were trying to move away from, and you
  // had to clear a field before you could use the box at all.
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleSearch() {
    if (!query.trim()) return;
    setErrorMsg(null);
    startTransition(async () => {
      const res = await searchTescoProducts(query);
      setResults(res);
      if (res.length === 0) {
        setErrorMsg('No products found matching your search.');
      }
    });
  }

  function handleSelect(product: any) {
    setErrorMsg(null);
    startSaving(async () => {
      const res = await updateIngredientProductMapping(
        basketItemId,
        ingredientId,
        product.product_uid,
        product.name,
        product.size,
        product.price,
        product.imageUrl
      );
      if (res.status === 'error') {
        setErrorMsg(res.message);
      } else {
        onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-md">
      <Card className="w-full max-w-lg flex flex-col gap-md max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-sm">
          <div className="min-w-0">
            <h3 className="font-title-md text-title-md text-on-surface">Swap this for something else</h3>
            {/* The box below starts empty, so this is where you see what you
                are replacing. */}
            <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
              Currently: {itemName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-surface-container"
          >
            <Icon name="close" className="text-on-surface-variant" />
          </button>
        </div>

        <div className="flex gap-sm">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search Tesco — e.g. free range eggs"
            className="flex-grow h-11 px-sm rounded-lg bg-surface-container border border-surface-container-highest text-on-surface font-body-md focus:outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={isPending}
            onClick={handleSearch}
            className="h-11 px-md rounded-lg bg-primary text-on-primary font-semibold flex items-center gap-xs hover:opacity-90 disabled:opacity-50"
          >
            <Icon name={isPending ? 'progress_activity' : 'search'} />
            Search
          </button>
        </div>

        {errorMsg && <p className="font-body-sm text-body-sm text-error">{errorMsg}</p>}

        <div className="flex flex-col gap-sm overflow-y-auto max-h-[40vh] pr-xs">
          {results.map((product) => (
            <button
              key={product.product_uid}
              type="button"
              disabled={isSaving}
              onClick={() => handleSelect(product)}
              className="text-left p-sm rounded-lg bg-surface-container-low hover:bg-surface-container-highest border border-surface-container-highest flex items-center gap-md transition-colors disabled:opacity-50"
            >
              {/* Seeing the product is most of how anyone judges a swap — a
                  name alone makes own-brand and branded look interchangeable. */}
              <FoodImage
                src={product.imageUrl}
                seed={product.product_uid}
                alt={product.name}
                icon="grocery"
                className="w-14 h-14 rounded-lg shrink-0 text-[24px] object-contain bg-surface-container-lowest"
              />
              <div className="min-w-0 flex-1">
                <p className="font-body-md text-body-md font-semibold text-on-surface truncate">
                  {product.name}
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                  {/* `size` is not populated by the provider, so derive the pack
                      from the title rather than showing a bare "each". */}
                  {packLabel(product.name) ?? product.size}
                </p>
              </div>
              <span className="font-numeric-data text-numeric-data text-primary shrink-0">
                {formatPence(product.price)}
              </span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
