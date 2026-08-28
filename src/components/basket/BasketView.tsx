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
import { BrandSwapModal } from '@/components/basket/BrandSwapModal';

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

  const [removed, setRemoved] = useState<Set<string>>(new Set());
  // Categories start open: a basket you have to unfold before you can check it
  // is a basket nobody checks. Collapsing is for after you have read a section.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [actualTotalCost, setActualTotalCost] = useState<number | null>(null);
  const [selectedSwapItem, setSelectedSwapItem] = useState<{
    id: string;
    ingredientId: string | null;
    name: string;
  } | null>(null);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);

  // isSyncing drives the disabled states, so the transition's own pending
  // flag is not needed.
  const [, startTransition] = useTransition();
  const [isSyncing, setIsSyncing] = useState(false);
  const [sessionAuth, setSessionAuth] = useState(false);
  const [sessionExpiry, setSessionExpiry] = useState<string | undefined>();
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    checkTescoSession()
      .then((res) => {
        setSessionAuth(Boolean(res.authenticated));
        setSessionExpiry(res.expiresAt);
      })
      .catch((err) => console.error('Tesco session check failed:', err));
  }, []);

  const byId = new Map(housemates.map((user) => [user.id, user]));

  const liveItems = useMemo(
    () =>
      items
        .filter((item) => !removed.has(item.id))
        .map((item) => ({
          ...item,
          quantity: quantities[item.id] ?? item.quantity,
        })),
    [items, quantities, removed]
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

  /** Days until the Tesco session lapses, or null when unknown. */
  const sessionDaysLeft = (() => {
    if (!sessionExpiry) return null;
    const ms = new Date(sessionExpiry).getTime() - Date.now();
    return Number.isFinite(ms) ? Math.floor(ms / 86_400_000) : null;
  })();

  async function handleCheckoutClick() {
    if (!sessionAuth) {
      setSyncStatusMsg('Tesco session required. Please set up your Tesco session cookies in House Settings.');
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
    } else {
      if (newTab) {
        newTab.location.href = 'https://www.tesco.com/groceries/en-GB/trolley';
      } else {
        window.open('https://www.tesco.com/groceries/en-GB/trolley', '_blank');
      }

      // Fetch actual checkout cost dynamically
      setSyncStatusMsg('Fetching actual Tesco checkout cost...');
      const checkoutRes = await startTescoCheckout();
      if (checkoutRes.status === 'success' && checkoutRes.totalCost !== undefined) {
        setActualTotalCost(checkoutRes.totalCost);
        setSyncStatusMsg(null); // Clear success message - keep it silent as requested
      } else {
        setSyncStatusMsg(`Synced successfully, but could not fetch checkout total: ${checkoutRes.message}`);
      }
    }
  }

  return (
    <>
    {selectedSwapItem && (
      <BrandSwapModal
        isOpen={isSwapModalOpen}
        onClose={() => {
          setIsSwapModalOpen(false);
          setSelectedSwapItem(null);
        }}
        basketItemId={selectedSwapItem.id}
        ingredientId={selectedSwapItem.ingredientId}
        itemName={selectedSwapItem.name}
      />
    )}

    {syncStatusMsg && (
      <Card
        accent={
          syncStatusMsg.toLowerCase().includes('error') || syncStatusMsg.toLowerCase().includes('required')
            ? 'error'
            : 'primary'
        }
        className="flex flex-col gap-sm"
      >
        <div className="flex items-center justify-between gap-sm">
          <p className="font-body-sm text-body-sm font-semibold">{syncStatusMsg}</p>
          <button
            type="button"
            onClick={() => setSyncStatusMsg(null)}
            className="text-on-surface-variant hover:text-on-surface text-xs font-bold shrink-0"
          >
            Dismiss
          </button>
        </div>
        {syncStatusMsg.toLowerCase().includes('session') && (
          <a
            href="/settings"
            className="mt-xs inline-flex items-center justify-center gap-xs px-sm h-9 bg-primary text-on-primary rounded-lg font-semibold text-xs self-start hover:opacity-90 transition-opacity"
          >
            <Icon name="settings" className="text-sm" />
            Go to House Settings
          </a>
        )}
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

        {/* This used to be a "Swap to Own-Brand" switch. It was a lie: it
            flipped displayed prices in React state and wrote nothing, so the
            total moved while the basket, the split and what would actually be
            sent to Tesco all stayed exactly the same. The cheapest matching
            product is already chosen when the basket is built, so there was
            never a choice here to offer — only a fact to state. Per-item "Swap
            brand" is the real control and it does write. */}
        {availableSwapValue > 0 && (
          <>
            <div className="h-px bg-surface-container-highest w-full" />
            <p className="flex items-start gap-sm font-body-sm text-body-sm text-on-surface-variant">
              <Icon name="savings" className="text-primary mt-0.5 shrink-0 text-[18px]" />
              <span>
                Own-brand picks have already taken{' '}
                <strong className="font-numeric-data text-on-surface">
                  {formatPence(availableSwapValue)}
                </strong>{' '}
                off this shop. Swap any line back yourself if the house wants the brand.
              </span>
            </p>
          </>
        )}
      </Card>



      {grouped.map(({ category, items: categoryItems }) => {
        const meta = CATEGORY_META[category];
        const isCollapsed = collapsed.has(category);
        const sectionTotal = categoryItems
          .filter((item) => !item.needsPackData)
          .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

        return (
          <section key={category} className="flex flex-col">
            <button
              type="button"
              aria-expanded={!isCollapsed}
              onClick={() =>
                setCollapsed((current) => {
                  const next = new Set(current);
                  if (next.has(category)) next.delete(category);
                  else next.add(category);
                  return next;
                })
              }
              className="w-full flex items-center gap-sm py-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
            >
              <Icon name={meta.icon} className={meta.tone} />
              <h3 className="font-title-md text-title-md text-on-surface">{meta.label}</h3>
              <span className="font-numeric-data text-[12px] text-on-surface-variant">
                {categoryItems.length}
              </span>
              <span className="flex-1" />
              {/* The section total is why collapsing is worth having: folded up,
                  a category still tells you what it costs. */}
              <span className="font-numeric-data text-body-lg text-on-surface-variant">
                {formatPence(sectionTotal)}
              </span>
              <Icon
                name="expand_more"
                className={clsx(
                  'text-on-surface-variant transition-transform',
                  isCollapsed && '-rotate-90'
                )}
              />
            </button>

            <ul className={clsx('flex flex-col gap-xs', isCollapsed && 'hidden')}>
              {categoryItems.map((item) => {
                const original = item.originalUnitPrice;
                const swapped = original !== null && original > item.unitPrice;
                const allocatedUsers = item.allocatedTo
                  .map((allocation) => byId.get(allocation.userId))
                  .filter((user): user is User => Boolean(user));

                return (
                  <li
                    key={item.id}
                    className="bg-surface-container-lowest rounded-lg border border-surface-container-highest px-sm py-xs flex items-center gap-sm"
                  >
                    <FoodImage
                      src={item.imageUrl}
                      seed={item.tescoProductId}
                      alt={item.name}
                      icon="grocery"
                      className="w-12 h-12 rounded-lg shrink-0 text-[22px] object-contain"
                    />

                    <div className="flex-1 flex flex-col min-w-0">
                      <span className="font-body-lg text-body-lg font-semibold leading-tight truncate">
                        {item.name}
                      </span>
                      {/* An assumed quantity is stated, not hidden. The
                          collector is the only person who can say whether one
                          bunch of spring onions covers four. */}
                      {item.quantityAssumed && (
                        <span className="mt-xs flex items-center gap-xs w-fit px-2 py-0.5 rounded-full bg-secondary-fixed/50 border border-secondary-container/40">
                          <Icon name="help" className="text-secondary text-[14px]" />
                          <span className="font-label-caps text-label-caps uppercase text-secondary">
                            1 pack assumed — check
                          </span>
                        </span>
                      )}

                      <div className="flex items-center gap-xs flex-wrap">
                        <span className="font-body-sm text-[12px] text-on-surface-variant">
                          {item.subtitle}
                        </span>
                        <span aria-hidden="true" className="text-on-surface-variant/40">
                          ·
                        </span>
                        {allocatedUsers.length === 0 ? (
                          <span className="bg-surface-container-highest text-on-surface-variant text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Shared
                          </span>
                        ) : (
                          // Names cost a line at five housemates; the faces do
                          // the job and the title carries the names.
                          <span
                            className="flex items-center -space-x-1.5"
                            title={allocatedUsers.map((user) => user.name).join(', ')}
                          >
                            {allocatedUsers.map((user) => (
                              <Avatar
                                key={user.id}
                                user={user}
                                size="xs"
                                className="ring-2 ring-surface-container-lowest"
                              />
                            ))}
                          </span>
                        )}
                        {isCollector && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSwapItem({
                                id: item.id,
                                ingredientId: item.ingredientId,
                                name: item.name,
                              });
                              setIsSwapModalOpen(true);
                            }}
                            className="text-primary hover:underline text-[10px] font-bold uppercase tracking-wider ml-sm flex items-center gap-xs"
                          >
                            <Icon name="swap_horiz" className="text-xs" />
                            Swap Brand
                          </button>
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
                          className="w-11 h-11 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest rounded focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
                          className="w-11 h-11 flex items-center justify-center text-primary hover:bg-primary-container hover:text-on-primary-container rounded focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
      {sessionAuth && sessionDaysLeft !== null && sessionDaysLeft <= 2 && (
        <div
          role="status"
          className="flex items-start gap-sm p-md rounded-lg bg-secondary-fixed/40 border border-secondary-container/40"
        >
          <Icon name="schedule" filled className="text-secondary mt-0.5 text-[18px]" />
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {sessionDaysLeft <= 0
              ? 'Your Tesco session expires today — re-import cookies before checking out.'
              : `Your Tesco session expires in ${sessionDaysLeft} day${sessionDaysLeft === 1 ? '' : 's'}.`}
          </p>
        </div>
      )}

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
            className="bg-secondary-container hover:bg-secondary text-on-secondary font-title-md text-title-md px-lg py-sm rounded-xl transition-colors flex-1 md:flex-none text-center disabled:opacity-50 disabled:cursor-not-allowed"
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

