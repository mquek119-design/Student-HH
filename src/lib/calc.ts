/**
 * Pure derivations over domain types.
 *
 * Deliberately free of any data-source import so client components can use
 * these too — `queries.ts` is server-only and must not be pulled into a client
 * bundle just to total a basket.
 */

import { allocateLine } from './money';
import type { BasketItem, LedgerEntry, Pence } from './types';

export function basketLineTotal(item: BasketItem): Pence {
  return item.unitPrice * item.quantity;
}

export function basketTotal(items: BasketItem[]): Pence {
  return items.reduce((sum, item) => sum + basketLineTotal(item), 0);
}

/** Savings already banked by own-brand swaps sitting in the basket. */
export function basketSavings(items: BasketItem[]): Pence {
  return items.reduce((sum, item) => {
    if (item.originalUnitPrice === null) return sum;
    return sum + (item.originalUnitPrice - item.unitPrice) * item.quantity;
  }, 0);
}

/** What every housemate owes across the whole basket, in pence. */
export function perPersonTotals(
  items: BasketItem[],
  allUserIds: string[]
): Record<string, Pence> {
  const totals: Record<string, Pence> = Object.fromEntries(
    allUserIds.map((id) => [id, 0])
  );

  for (const item of items) {
    const line = allocateLine(basketLineTotal(item), item.allocatedTo, allUserIds);
    for (const [userId, amount] of Object.entries(line)) {
      totals[userId] = (totals[userId] ?? 0) + amount;
    }
  }
  return totals;
}

/**
 * Net position per housemate across the ledger: positive means the house owes
 * them, negative means they owe the house. Confirmed entries are settled and
 * drop out.
 */
export function netBalances(
  entries: LedgerEntry[],
  allUserIds: string[]
): Record<string, Pence> {
  const net: Record<string, Pence> = Object.fromEntries(
    allUserIds.map((id) => [id, 0])
  );

  for (const entry of entries) {
    if (entry.status === 'confirmed') continue;
    net[entry.toUserId] = (net[entry.toUserId] ?? 0) + entry.amount;
    net[entry.fromUserId] = (net[entry.fromUserId] ?? 0) - entry.amount;
  }
  return net;
}
