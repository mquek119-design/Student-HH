/**
 * The overlap optimiser.
 *
 * Turns a week of planned meals into one shop, and explains every number it
 * produces. This is the product's actual claim, so nothing here is estimated:
 * a figure is either derived from real quantities and real pack data, or it is
 * reported as unknown.
 *
 * The order matters:
 *   1. Scale each recipe to the number of people actually eating it
 *   2. Aggregate identical ingredients across every meal   ← the overlap
 *   3. Subtract what the pantry already covers
 *   4. Round up to whole packs
 *   5. Attribute each line back to the people whose meals needed it
 *
 * Savings fall out of steps 2 and 3 by construction: compare packs bought
 * against packs each meal would have bought shopping alone.
 */

import { splitPence } from './money';
import type { PantryItem, Pence, PlannedMeal, Recipe } from './types';
import { baseUnitLabel, convert, toBaseQuantity, unitGroup } from './units';

/** Pack data recorded once per ingredient; null until the house fills it in. */
export interface IngredientPack {
  ingredientId: string;
  name: string;
  category: Recipe['ingredients'][number]['category'];
  packSize: number | null;
  packUnit: string | null;
  packPrice: Pence | null;
  originalPrice: Pence | null;
}

/** One meal's claim on an ingredient, kept so the line can be attributed back. */
interface Demand {
  mealId: string;
  /** Quantity in the group's base unit, already scaled to the diner count. */
  baseQuantity: number;
  userIds: string[];
}

export interface BasketLine {
  ingredientId: string;
  name: string;
  category: IngredientPack['category'];
  /** Total needed across the week, in `unitLabel`. */
  neededQuantity: number;
  unitLabel: string;
  /** Covered by the pantry, so never bought. */
  pantryQuantity: number;
  /** Whole packs to buy. Null when pack data is missing. */
  packs: number | null;
  packSize: number | null;
  packUnit: string | null;
  unitPrice: Pence | null;
  originalUnitPrice: Pence | null;
  lineTotal: Pence | null;
  /** Packs each meal would have bought shopping separately. */
  packsIfSeparate: number | null;
  /** Packs avoided thanks to the pantry. */
  packsFromPantry: number | null;
  /** Relative weights per user, for splitPence(). Empty means split equally. */
  allocations: { userId: string; share: number }[];
  /** Why this line cannot be priced, when it cannot. */
  blocked: 'no-pack-data' | 'incompatible-units' | null;
}

export interface OptimisedBasket {
  lines: BasketLine[];
  /** Packs saved by pooling meals, valued at pack price. */
  overlapSavings: Pence;
  /** Packs saved because the pantry already had it. */
  pantrySavings: Pence;
  totalCost: Pence;
  /** Lines we could not price — the UI prompts for pack data for these. */
  needsPackData: { ingredientId: string; name: string }[];
}

/** How many people are actually eating a meal. */
function dinerCount(meal: PlannedMeal): number {
  return Math.max(1, meal.participants.filter((p) => !p.optedOut).length);
}

export function optimiseBasket(
  meals: PlannedMeal[],
  recipes: Recipe[],
  pantry: PantryItem[],
  packs: IngredientPack[]
): OptimisedBasket {
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const packById = new Map(packs.map((p) => [p.ingredientId, p]));

  // Key on ingredient AND unit group: "2 tins" and "400 g" of tomatoes are not
  // the same purchase, so they must not be summed.
  const demands = new Map<string, { group: string; ingredientId: string; items: Demand[] }>();

  for (const meal of meals) {
    const recipe = recipeById.get(meal.recipeId);
    if (!recipe) continue;

    const diners = dinerCount(meal);
    // Recipes are written for `servings`; scale to who is actually eating.
    const scale = diners / Math.max(1, recipe.servings);
    const userIds = meal.participants.filter((p) => !p.optedOut).map((p) => p.userId);

    for (const ingredient of recipe.ingredients) {
      const group = unitGroup(ingredient.unit);
      const base = toBaseQuantity(ingredient.quantity * scale, ingredient.unit);
      if (base === null) continue;

      const key = `${ingredient.ingredientId}::${group}`;
      const entry = demands.get(key) ?? {
        group,
        ingredientId: ingredient.ingredientId,
        items: [],
      };
      entry.items.push({ mealId: meal.id, baseQuantity: base, userIds });
      demands.set(key, entry);
    }
  }

  const lines: BasketLine[] = [];
  let overlapSavings = 0;
  let pantrySavings = 0;
  let totalCost = 0;
  const needsPackData: { ingredientId: string; name: string }[] = [];

  for (const [, entry] of demands) {
    const pack = packById.get(entry.ingredientId);
    const unitLabel = baseUnitLabel(entry.group);
    const totalNeeded = entry.items.reduce((sum, d) => sum + d.baseQuantity, 0);

    // --- Pantry subtraction -------------------------------------------------
    // Only count stock that is not flagged low: half a bottle of oil should not
    // stop us buying more.
    const pantryHave = pantry
      .filter((item) => item.ingredientId === entry.ingredientId && !item.lowStock)
      .reduce((sum, item) => {
        const base = toBaseQuantity(item.quantityRemaining, item.unit);
        return base !== null && unitGroup(item.unit) === entry.group ? sum + base : sum;
      }, 0);

    const pantryUsed = Math.min(pantryHave, totalNeeded);
    const toBuy = Math.max(0, totalNeeded - pantryUsed);

    // --- Attribution --------------------------------------------------------
    // A user's weight is the sum, over meals they eat, of that meal's share of
    // the ingredient divided among its diners. Someone eating two pasta dishes
    // fairly carries more of the pasta than someone eating one.
    const weights = new Map<string, number>();
    for (const demand of entry.items) {
      if (demand.userIds.length === 0) continue;
      const perHead = demand.baseQuantity / demand.userIds.length;
      for (const userId of demand.userIds) {
        weights.set(userId, (weights.get(userId) ?? 0) + perHead);
      }
    }
    const allocations = [...weights.entries()]
      .filter(([, share]) => share > 0)
      .map(([userId, share]) => ({ userId, share }));

    const base: Omit<BasketLine, 'packs' | 'unitPrice' | 'originalUnitPrice' | 'lineTotal' | 'packsIfSeparate' | 'packsFromPantry' | 'blocked'> = {
      ingredientId: entry.ingredientId,
      name: pack?.name ?? 'Unknown ingredient',
      category: pack?.category ?? 'cupboard',
      neededQuantity: Math.round(totalNeeded * 100) / 100,
      unitLabel,
      pantryQuantity: Math.round(pantryUsed * 100) / 100,
      packSize: pack?.packSize ?? null,
      packUnit: pack?.packUnit ?? null,
      allocations,
    };

    // --- Packing ------------------------------------------------------------
    if (!pack || pack.packSize === null || pack.packUnit === null) {
      if (pack) needsPackData.push({ ingredientId: entry.ingredientId, name: pack.name });
      lines.push({
        ...base,
        packs: null,
        unitPrice: null,
        originalUnitPrice: null,
        lineTotal: null,
        packsIfSeparate: null,
        packsFromPantry: null,
        blocked: 'no-pack-data',
      });
      continue;
    }

    // Express one pack in the same base unit as the demand.
    const packInBase = convert(pack.packSize, pack.packUnit, unitLabel);
    if (packInBase === null || packInBase <= 0) {
      lines.push({
        ...base,
        packs: null,
        unitPrice: null,
        originalUnitPrice: null,
        lineTotal: null,
        packsIfSeparate: null,
        packsFromPantry: null,
        blocked: 'incompatible-units',
      });
      continue;
    }

    const packs = Math.ceil(toBuy / packInBase);

    // Counterfactual: every meal shopping on its own, each rounding up alone.
    const packsIfSeparate = entry.items.reduce(
      (sum, d) => sum + Math.ceil(d.baseQuantity / packInBase),
      0
    );
    // Counterfactual: no pantry, so the full need is bought.
    const packsWithoutPantry = Math.ceil(totalNeeded / packInBase);
    const packsFromPantry = Math.max(0, packsWithoutPantry - packs);

    const unitPrice = pack.packPrice;
    const lineTotal = unitPrice === null ? null : unitPrice * packs;

    if (unitPrice !== null) {
      totalCost += lineTotal ?? 0;
      // Overlap saving is measured against the aggregated-but-unpantried case,
      // so pooling and pantry credit are never double-counted.
      overlapSavings += Math.max(0, packsIfSeparate - packsWithoutPantry) * unitPrice;
      pantrySavings += packsFromPantry * unitPrice;
    } else {
      needsPackData.push({ ingredientId: entry.ingredientId, name: pack.name });
    }

    lines.push({
      ...base,
      packs,
      unitPrice,
      originalUnitPrice: pack.originalPrice,
      lineTotal,
      packsIfSeparate,
      packsFromPantry,
      blocked: null,
    });
  }

  // Priced lines first, then things needing attention, then alphabetical.
  lines.sort((a, b) => {
    if ((a.blocked === null) !== (b.blocked === null)) return a.blocked === null ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { lines, overlapSavings, pantrySavings, totalCost, needsPackData };
}

/**
 * Splits one line's cost across housemates using the optimiser's weights,
 * falling back to an equal split for lines nobody specifically claimed
 * (shared staples). Remainder pence go to the largest shares.
 */
export function allocateBasketLine(
  line: BasketLine,
  allHouseUserIds: string[]
): Record<string, Pence> {
  if (line.lineTotal === null) return {};

  const allocations =
    line.allocations.length > 0
      ? line.allocations
      : allHouseUserIds.map((userId) => ({ userId, share: 1 }));

  const amounts = splitPence(line.lineTotal, allocations.map((a) => a.share));
  const out: Record<string, Pence> = {};
  allocations.forEach((allocation, i) => {
    out[allocation.userId] = (out[allocation.userId] ?? 0) + amounts[i];
  });
  return out;
}
