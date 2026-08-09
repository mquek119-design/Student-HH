'use client';

import { useMemo, useState, useTransition, useEffect } from 'react';
import { Avatar } from '@/components/avatars/Avatar';
import { FoodImage } from '@/components/media/FoodImage';
import { Icon } from '@/components/media/Icon';
import { Card } from '@/components/ui/Card';
import { clsx } from '@/lib/clsx';
import { formatPence } from '@/lib/money';
import { basketLineTotal, basketSavings, basketTotal } from '@/lib/calc';
import type { BasketItem, IngredientCategory, User } from '@/lib/types';
import { updateBasketItemQuantity } from '@/app/basket/actions';
import { checkTescoSession, syncBasketToTesco, startTescoCheckout } from '@/app/basket/tescoActions';
import { TescoSessionModal } from '@/components/basket/TescoSessionModal';

/**
 * Basket review — the collector's screen before the order goes to Tesco.
 *
 * The own-brand toggle is presentational here: it reveals the swap prices the
 * optimiser already found (`originalUnitPrice`). Committing a swap will call
 * the Tesco provider through a server action, never from this component.
 */

const CATEGORY_META: Record<IngredientCategory, { label: string; icon: string; tone: string }> = {
  fresh: { label: 'Fresh', icon: 'eco', tone: 'text-primary' },
  cupboard: { label: 'Cupboard', icon: 'inventory_2', tone: 'text-secondary' },
  frozen: { label: 'Frozen', icon: 'ac_unit', tone: 'text-[#0061a4]' },
  household: { label: 'Household', icon: 'cleaning_services', tone: 'text-tertiary' },
};

const CATEGORY_ORDER: IngredientCategory[] = ['fresh', 'cupboard', 'frozen', 'household'];

interface BasketViewProps {
  items: BasketItem[];
  housemates: User[];
  /** Only the collector can place the order. */
  isCollector: boolean;
  collectorName: string;
  planId?: string;
}

export function BasketView({ items, housemates, isCollector, collectorName, planId }: BasketViewProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>(
    () => Object.fromEntries(items.map((item) => [item.id, item.quantity]))
  );
  const [ownBrand, setOwnBrand] = useState(true);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [fulfillmentMethod, setFulfillmentMethod] = useState<'collect' | 'delivery'>('collect');
  const [postcode, setPostcode] = useState('');
  const [collectStore, setCollectStore] = useState('coventry cannon park rear car park 1');
  const [actualTotalCost, setActualTotalCost] = useState<number | null>(null);

  const [isPending, startTransition] = useTransition();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sessionAuth, setSessionAuth] = useState(false);
  const [sessionExpiry, setSessionExpiry] = useState<string | undefined>();
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    checkTescoSession().then((res) => {
      setSessionAuth(Boolean(res.authenticated));
      setSessionExpiry(res.expiresAt);
    });
  }, []);

  const byId = new Map(housemates.map((user) => [user.id, user]));

  const liveItems = useMemo(
    () =>
      items
        .filter((item) => !removed.has(item.id))
        .map((item) => ({
          ...item,
          quantity: quantities[item.id] ?? item.quantity,
          // Toggling own-brand off reverts to the branded price where one exists.
          unitPrice: ownBrand ? item.unitPrice : (item.originalUnitPrice ?? item.unitPrice),
        })),
    [items, quantities, ownBrand, removed]
  );

  // Unpriced lines contribute nothing to the total; the count is surfaced
  // separately so the figure is never mistaken for the finished bill.
  const total = basketTotal(liveItems.filter((item) => !item.needsPackData));
  const savings = basketSavings(liveItems);
  const unpricedCount = liveItems.filter((item) => item.needsPackData).length;
  const availableSwapValue = items
    .filter((item) => item.originalUnitPrice !== null)
    .reduce(
      (sum, item) =>
        sum + (item.originalUnitPrice! - item.unitPrice) * (quantities[item.id] ?? item.quantity),
      0
    );

  function setQuantity(id: string, next: number) {
    if (next <= 0) {
      setRemoved((prev) => new Set(prev).add(id));
    } else {
      setQuantities((prev) => ({ ...prev, [id]: next }));
    }
    startTransition(async () => {
      await updateBasketItemQuantity(id, next);
    });
  }

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: liveItems.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);

  async function handleCheckoutClick() {
    if (!sessionAuth) {
      setIsModalOpen(true);
      return;
    }
    if (!planId) {
      setSyncStatusMsg('No active weekly plan ID.');
      return;
    }

    // Open a blank tab synchronously during user click gesture to bypass popup blockers
    const newTab = window.open('', '_blank');
    if (newTab) {
      newTab.document.write(
        '<p style="font-family:sans-serif;text-align:center;margin-top:20%;color:#006b3f;font-weight:bold;">Syncing your HouseGrocer basket to Tesco... Please wait.</p>'
      );
    }

    setIsSyncing(true);
    setSyncStatusMsg('Pushing items to Tesco online basket...');
    const res = await syncBasketToTesco(planId);
    setIsSyncing(false);

    if (res.status === 'error') {
      setSyncStatusMsg(`Sync error: ${res.message}`);
      if (newTab) newTab.close();
      if (res.message.toLowerCase().includes('session')) {
        setIsModalOpen(true);
      }
    } else {
      setSyncStatusMsg(res.message);
      if (newTab) {
        newTab.location.href = 'https://www.tesco.com/groceries/en-GB/trolley';
      } else {
        window.open('https://www.tesco.com/groceries/en-GB/trolley', '_blank');
      }

      // Fetch actual checkout cost dynamically with selected fulfillment settings
      setSyncStatusMsg('Fetching actual Tesco checkout cost...');
      const checkoutRes = await startTescoCheckout(planId, {
        fulfillmentMethod,
        postcode,
        collectStore,
      });
      if (checkoutRes.status === 'success' && checkoutRes.totalCost !== undefined) {
        setActualTotalCost(checkoutRes.totalCost);
        setSyncStatusMsg(`Synced successfully! Actual Tesco Total: ${formatPence(checkoutRes.totalCost)}.`);
      } else {
        setSyncStatusMsg(`Synced successfully, but could not fetch actual checkout total: ${checkoutRes.message}`);
      }
    }
  }

  return (
    <>
      <TescoSessionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSessionImported={() => {
          checkTescoSession().then((res) => {
            setSessionAuth(Boolean(res.authenticated));
            setSessionExpiry(res.expiresAt);
          });
        }}
        isAuthenticated={sessionAuth}
        expiresAt={sessionExpiry}
      />

      {syncStatusMsg && (
        <Card accent="primary" className="flex items-center justify-between gap-sm">
          <p className="font-body-sm text-body-sm font-semibold">{syncStatusMsg}</p>
          <button
            type="button"
            onClick={() => setSyncStatusMsg(null)}
            className="text-on-surface-variant hover:text-on-surface text-xs font-bold"
          >
            Dismiss
          </button>
        </Card>
      )}

      <Card className="flex flex-col gap-md">
        <div className="flex justify-between items-start gap-md">
          <div>
            <h2 className="font-title-md text-title-md text-on-surface">Basket Total</h2>
            <p className="font-numeric-data text-headline-lg-mobile text-primary mt-base">
              {formatPence(total)}
            </p>
            {unpricedCount > 0 && (
              <p className="font-body-sm text-body-sm text-secondary">
                Excludes {unpricedCount} unpriced item{unpricedCount === 1 ? '' : 's'}
              </p>
            )}
          </div>
          <div className="bg-primary-container text-on-primary-container rounded-lg px-sm py-xs flex flex-col items-end shrink-0">
            <span className="font-label-caps text-label-caps opacity-80">Est. Savings</span>
            <span className="font-numeric-data text-numeric-data">{formatPence(savings)}</span>
          </div>
        </div>

        <div className="h-px bg-surface-container-highest w-full" />

        <div className="flex items-center justify-between gap-md">
          <div>
            <h3 className="font-body-lg text-body-lg font-semibold">Swap to Own-Brand</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {ownBrand
                ? `Saving ${formatPence(availableSwapValue)} on this order`
                : `Save approx ${formatPence(availableSwapValue)} instantly`}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={ownBrand}
              onChange={(event) => setOwnBrand(event.target.checked)}
            />
            <span className="sr-only">Swap branded items to own-brand</span>
            <div className="w-11 h-6 bg-surface-container-highest rounded-full peer peer-checked:bg-secondary-container peer-focus-visible:ring-2 peer-focus-visible:ring-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white" />
          </label>
        </div>
      </Card>

      {isCollector && (
        <Card className="flex flex-col gap-md">
          <div className="flex flex-col">
            <h2 className="font-title-md text-title-md text-on-surface">Tesco Delivery & Collection Settings</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs">
              Configure how you want to receive this order. This determines the checkout pricing slot/delivery calculation.
            </p>
          </div>

          <div className="flex gap-md mt-sm">
            <label className="flex-1 flex items-center gap-xs cursor-pointer bg-surface-container hover:bg-surface-container-highest p-sm rounded-lg transition-colors border border-transparent has-[:checked]:border-primary">
              <input
                type="radio"
                name="fulfillment"
                value="collect"
                checked={fulfillmentMethod === 'collect'}
                onChange={() => setFulfillmentMethod('collect')}
                className="text-primary focus:ring-primary"
              />
              <span className="font-body-md text-body-md font-semibold ml-xs">Click + Collect</span>
            </label>
            <label className="flex-1 flex items-center gap-xs cursor-pointer bg-surface-container hover:bg-surface-container-highest p-sm rounded-lg transition-colors border border-transparent has-[:checked]:border-primary">
              <input
                type="radio"
                name="fulfillment"
                value="delivery"
                checked={fulfillmentMethod === 'delivery'}
                onChange={() => setFulfillmentMethod('delivery')}
                className="text-primary focus:ring-primary"
              />
              <span className="font-body-md text-body-md font-semibold ml-xs">Home Delivery</span>
            </label>
          </div>

          {fulfillmentMethod === 'collect' ? (
            <div className="flex flex-col gap-xs mt-sm">
              <label htmlFor="collect-store-input" className="font-label-caps text-label-caps text-on-surface-variant">
                Collection Location
              </label>
              <input
                id="collect-store-input"
                type="text"
                value={collectStore}
                onChange={(e) => setCollectStore(e.target.value)}
                placeholder="Enter store name or postcode"
                className="h-11 px-sm rounded-lg bg-surface-container border border-surface-container-highest text-on-surface font-body-md focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-xs mt-sm">
              <label htmlFor="postcode-input" className="font-label-caps text-label-caps text-on-surface-variant">
                Delivery Postcode
              </label>
              <input
                id="postcode-input"
                type="text"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                placeholder="e.g. CV4 7AL"
                className="h-11 px-sm rounded-lg bg-surface-container border border-surface-container-highest text-on-surface font-body-md focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          )}
        </Card>
      )}

      {grouped.map(({ category, items: categoryItems }) => {
        const meta = CATEGORY_META[category];
        return (
          <section key={category} className="flex flex-col gap-sm">
            <h3 className="font-title-md text-title-md text-on-surface flex items-center gap-sm">
              <Icon name={meta.icon} className={meta.tone} />
              {meta.label}
            </h3>

            <ul className="flex flex-col gap-sm">
              {categoryItems.map((item) => {
                const original = item.originalUnitPrice;
                const swapped = ownBrand && original !== null && original > item.unitPrice;
                const allocatedUsers = item.allocatedTo
                  .map((allocation) => byId.get(allocation.userId))
                  .filter((user): user is User => Boolean(user));

                return (
                  <li
                    key={item.id}
                    className="bg-surface-container-lowest rounded-xl shadow-ambient-card border border-surface-container-highest p-sm flex items-center gap-md"
                  >
                    <FoodImage
                      seed={item.tescoProductId}
                      alt={item.name}
                      icon="grocery"
                      className="w-16 h-16 rounded-lg shrink-0 text-[28px]"
                    />

                    <div className="flex-1 flex flex-col min-w-0">
                      <span className="font-body-lg text-body-lg font-semibold truncate">
                        {item.name}
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                        {item.subtitle}
                      </span>
                      <div className="flex items-center gap-xs mt-base flex-wrap">
                        {allocatedUsers.length === 0 ? (
                          <span className="bg-surface-container-highest text-on-surface-variant text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Shared
                          </span>
                        ) : (
                          allocatedUsers.map((user) => (
                            <span key={user.id} className="flex items-center gap-xs">
                              <Avatar user={user} size="xs" />
                              <span className="font-label-caps text-label-caps text-on-surface-variant">
                                {user.name}
                              </span>
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-sm shrink-0">
                      <span className="flex flex-col items-end">
                        {swapped && (
                          <span className="font-numeric-data text-[11px] line-through text-on-surface-variant">
                            {formatPence(original! * item.quantity)}
                          </span>
                        )}
                        {item.needsPackData ? (
                          // Never render an unpriced line as £0.00 — it would
                          // read as free and quietly understate the split.
                          <span className="font-label-caps text-label-caps text-secondary">
                            No price
                          </span>
                        ) : (
                          <span
                            className={clsx(
                              'font-numeric-data text-numeric-data',
                              swapped && 'text-primary'
                            )}
                          >
                            {formatPence(basketLineTotal(item))}
                          </span>
                        )}
                      </span>

                      <div className="flex items-center gap-2 bg-surface-container rounded-lg p-1">
                        <button
                          type="button"
                          aria-label={`Decrease ${item.name}`}
                          onClick={() => setQuantity(item.id, item.quantity - 1)}
                          className="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest rounded"
                        >
                          <Icon name={item.quantity === 1 ? 'delete' : 'remove'} className="text-[16px]" />
                        </button>
                        <span className="font-numeric-data text-numeric-data w-4 text-center tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase ${item.name}`}
                          onClick={() => setQuantity(item.id, item.quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center text-primary hover:bg-primary-container hover:text-on-primary-container rounded"
                        >
                          <Icon name="add" className="text-[16px]" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {/* Persistent action bar — sits above the bottom nav on mobile. */}
      <div className="fixed bottom-[76px] md:bottom-0 left-0 w-full bg-surface-container-lowest border-t border-surface-container-highest p-md shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-md px-margin-mobile md:px-margin-desktop">
          <div className="flex flex-col">
            <span className="font-label-caps text-label-caps text-on-surface-variant">
              {actualTotalCost !== null ? 'Tesco Actual Total' : 'Estimated Total'}
            </span>
            <span className="font-numeric-data text-headline-lg-mobile text-on-surface">
              {actualTotalCost !== null ? formatPence(actualTotalCost) : formatPence(total)}
            </span>
          </div>
          <button
            type="button"
            disabled={!isCollector || liveItems.length === 0 || isSyncing}
            onClick={handleCheckoutClick}
            title={
              isCollector
                ? undefined
                : `Only ${collectorName} can place this week's order from their Tesco account.`
            }
            className="bg-secondary-container hover:bg-secondary text-on-primary font-title-md text-title-md px-lg py-sm rounded-xl transition-colors flex-1 md:flex-none text-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSyncing
              ? 'Syncing to Tesco...'
              : isCollector
                ? 'Proceed to Checkout'
                : `${collectorName} checks out`}
          </button>
        </div>
      </div>
    </>
  );
}

