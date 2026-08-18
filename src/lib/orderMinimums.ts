import type { Pence } from './types';

/**
 * Minimum spend before Tesco will accept an order.
 *
 * The app's founding premise is that a household clears a threshold a single
 * student cannot, so the basket has to show whether it has. One place to
 * correct these if Tesco changes them.
 *
 * Lives here rather than in `basket/actions.ts` because that file is
 * `'use server'`, and such a module may only export async functions — exporting
 * a plain object from it fails the build with "found object".
 */
export const ORDER_MINIMUMS: Record<'delivery' | 'collect', Pence> = {
  collect: 2500,
  delivery: 4000,
};
