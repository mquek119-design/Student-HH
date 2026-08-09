'use client';

import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/media/Icon';
import { formatPence } from '@/lib/money';
import { searchTescoProducts, updateIngredientProductMapping } from '@/app/basket/actions';

interface BrandSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  basketItemId: string;
  ingredientId: string | null;
  itemName: string;
}

export function BrandSwapModal({ isOpen, onClose, basketItemId, ingredientId, itemName }: BrandSwapModalProps) {
  const [query, setQuery] = useState(itemName);
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
        <div className="flex items-center justify-between">
          <h3 className="font-title-md text-title-md text-on-surface">Change Product Brand</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container"
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
            placeholder="Search Tesco brand, e.g. Free Range Eggs"
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
              className="text-left p-sm rounded-lg bg-surface-container-low hover:bg-surface-container-highest border border-surface-container-highest flex items-center justify-between gap-md transition-colors disabled:opacity-50"
            >
              <div className="min-w-0">
                <p className="font-body-md text-body-md font-semibold text-on-surface truncate">
                  {product.name}
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                  {product.size}
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
