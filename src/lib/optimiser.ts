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

/**
 * How a meal's diners divide it.
 *
 * A weight of 1 is one mouth. A housemate bringing a guest they are covering
 * weighs 2; a guest the table agreed to split weighs 1/n on everybody. This
 * replaced a plain `userIds: string[]` and reduces to exactly the old
 * behaviour when nobody brings anyone — every weight is 1.
 */
interface Head {
  userId: string;
  weight: number;
}

/** One meal's claim on an ingredient, kept so the line can be attributed back. */
interface Demand {
  mealId: string;
  /** Quantity in the group's base unit, already scaled to the diner count. */
  baseQuantity: number;
  heads: Head[];
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
  /**
   * True when the pack is sold by weight but the recipe counts items, so how
   * many packs to buy could not be calculated and one was assumed. Surfaced in
   * the basket for the collector to check, never hidden.
   */
  quantityAssumed: boolean;
  /** Why this line cannot be priced, when it cannot. */
  blocked: 'no-pack-data' | null;
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

/**
 * Who is eating, and how much of the meal each of them answers for.
 *
 * Guests have no account and no balance, so they never appear as a head of
 * their own — their weight is folded into whoever is paying for them. Covered
 * guests load their host; uncovered ones spread evenly across the table, which
 * is what "split across the table" means once you write it down.
 */
function headsFor(meal: PlannedMeal): Head[] {
  const eating = meal.participants.filter((p) => !p.optedOut);
  if (eating.length === 0) return [];

  const sharedGuests = eating.reduce(
    (sum, p) => sum + (p.guestsCovered === false ? (p.guests ?? 0) : 0),
    0
  );
  const sharedPerHead = sharedGuests / eating.length;

  return eating.map((p) => ({
    userId: p.userId,
    weight: 1 + (p.guestsCovered === false ? 0 : (p.guests ?? 0)) + sharedPerHead,
  }));
}

/** How many mouths a meal is cooked for, housemates and guests together. */
function dinerCount(meal: PlannedMeal): number {
  const total = headsFor(meal).reduce((sum, head) => sum + head.weight, 0);
  return Math.max(1, total);
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
    const heads = headsFor(meal);

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
      entry.items.push({ mealId: meal.id, baseQuantity: base, heads });
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
      const totalHeads = demand.heads.reduce((sum, head) => sum + head.weight, 0);
      if (totalHeads <= 0) continue;
      for (const head of demand.heads) {
        const share = (demand.baseQuantity * head.weight) / totalHeads;
        weights.set(head.userId, (weights.get(head.userId) ?? 0) + share);
      }
    }
    const allocations = [...weights.entries()]
      .filter(([, share]) => share > 0)
      .map(([userId, share]) => ({ userId, share }));

    const base: Omit<BasketLine, 'packs' | 'unitPrice' | 'originalUnitPrice' | 'lineTotal' | 'packsIfSeparate' | 'packsFromPantry' | 'blocked' | 'quantityAssumed'> = {
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
        quantityAssumed: false,
        blocked: 'no-pack-data',
      });
      continue;
    }

    // Express one pack in the same base unit as the demand.
    const packInBase = convert(pack.packSize, pack.packUnit, unitLabel);

    if (packInBase === null || packInBase <= 0) {
      // The recipe counts items ("3 garlic cloves", "4 slices of bread") but
      // Tesco sells the thing by weight, so there is no arithmetic that turns
      // one into the other — a 190g jar of garlic states no clove count.
      //
      // This used to drop the line out of the basket with no price, which
      // rendered as £0.00, quietly left it out of the total, and undercharged
      // everybody. Buying ONE is the better answer: a weighed pack is nearly
      // always a container of many countable things — a loaf, a bulb, a bunch,
      // a punnet — and one covers a week's recipe. It is flagged rather than
      // assumed silently, and the collector has a stepper.
      const assumedTotal = pack.packPrice;
      if (assumedTotal !== null) totalCost += assumedTotal;
      else needsPackData.push({ ingredientId: entry.ingredientId, name: pack.name });

      lines.push({
        ...base,
        packs: 1,
        unitPrice: pack.packPrice,
        originalUnitPrice: pack.originalPrice,
        lineTotal: assumedTotal,
        // No savings claim: we do not know what one pack covers, so we cannot
        // say what pooling or the pantry saved.
        packsIfSeparate: null,
        packsFromPantry: null,
        quantityAssumed: true,
        blocked: null,
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
      quantityAssumed: false,
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
