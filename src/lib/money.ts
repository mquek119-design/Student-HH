import type { Allocation, Pence } from './types';

/** Format integer pence as a GBP string, e.g. 3140 -> "£31.40". */
export function formatPence(pence: Pence): string {
  const sign = pence < 0 ? '-' : '';
  const abs = Math.abs(pence);
  return `${sign}£${(abs / 100).toFixed(2)}`;
}

/** Format without the currency symbol — for tables that carry their own header. */
export function formatPenceBare(pence: Pence): string {
  return (Math.abs(pence) / 100).toFixed(2);
}

/** Parse "12.34" or "£12.34" into 1234. Returns null on anything unparseable. */
export function parsePounds(input: string): Pence | null {
  const cleaned = input.replace(/[£,\s]/g, '');
  if (!/^-?\d*\.?\d{0,2}$/.test(cleaned) || cleaned === '' || cleaned === '-') {
    return null;
  }
  return Math.round(parseFloat(cleaned) * 100);
}

/**
 * Divide `total` across `weights` so the parts are integer pence that sum
 * back to exactly `total`. Remainder pence go to the largest weights first,
 * which keeps a 3-way split of 100p as 34/33/33 rather than losing a penny.
 */
export function splitPence(total: Pence, weights: number[]): Pence[] {
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0) return weights.map(() => 0);

  const exact = weights.map((w) => (total * w) / weightSum);
  const floors = exact.map(Math.floor);
  let remainder = total - floors.reduce((a, b) => a + b, 0);

  // Distribute the leftover pence to the largest fractional parts.
  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floors];
  for (let i = 0; remainder > 0; i = (i + 1) % order.length) {
    result[order[i].index] += 1;
    remainder -= 1;
  }
  return result;
}

/**
 * Work out what each housemate owes for one basket line.
 * An empty allocation list means the line is split equally across `allHouseUserIds`.
 */
export function allocateLine(
  lineTotal: Pence,
  allocatedTo: Allocation[],
  allHouseUserIds: string[]
): Record<string, Pence> {
  const allocations: Allocation[] =
    allocatedTo.length > 0
      ? allocatedTo
      : allHouseUserIds.map((userId) => ({ userId, share: 1 }));

  const amounts = splitPence(
    lineTotal,
    allocations.map((a) => a.share)
  );

  const out: Record<string, Pence> = {};
  allocations.forEach((allocation, i) => {
    out[allocation.userId] = (out[allocation.userId] ?? 0) + amounts[i];
  });
  return out;
}
