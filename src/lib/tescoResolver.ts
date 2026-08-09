import 'server-only';

/**
 * Resolves ingredient names to real Tesco products.
 *
 * Replaces asking the house to type in pack sizes and prices: search returns
 * both. Search hits Tesco's public endpoint and needs no session — only
 * add-to-basket and checkout require the authenticated flow.
 */

import { TescoAPI } from '../../lib/tesco/providers/tesco/api';
import { pickBestProduct, type ResolvedProduct } from './packParsing';

export type { ResolvedProduct };

/**
 * Looks up one ingredient. Returns null rather than throwing so a single
 * unmatched item never fails the whole basket build.
 */
export async function resolveIngredient(name: string): Promise<ResolvedProduct | null> {
  try {
    const api = new TescoAPI();
    const results = await api.searchProducts(name, 8);
    return pickBestProduct(results ?? [], name);
  } catch {
    return null;
  }
}

/** Resolves several ingredients, in series to stay gentle on Tesco's endpoint. */
export async function resolveIngredients(
  names: { ingredientId: string; name: string }[]
): Promise<Map<string, ResolvedProduct>> {
  const resolved = new Map<string, ResolvedProduct>();
  for (const entry of names) {
    const product = await resolveIngredient(entry.name);
    if (product) resolved.set(entry.ingredientId, product);
  }
  return resolved;
}
