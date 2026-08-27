'use server';

import { revalidatePath } from 'next/cache';
import {
  getCurrentUser,
  getHouse,
  getHouseStaples,
  getPantryItems,
  getRecipes,
  getWeeklyPlan,
} from '@/lib/queries';
import { optimiseBasket, type IngredientPack } from '@/lib/optimiser';
import { resolveIngredients } from '@/lib/tescoResolver';
import { parsePounds } from '@/lib/money';
import { createClient } from '@/lib/supabase/server';
import { TescoProvider } from '../../../lib/tesco/providers/tesco/index';

export interface BasketActionState {
  status: 'idle' | 'error' | 'built';
  message: string;
}

const fail = (message: string): BasketActionState => ({ status: 'error', message });

/**
 * How long a cached Tesco price stays trustworthy. Seven days lines up with
 * the weekly shop, so each cycle re-prices itself once and no more.
 */
const PRICE_TTL_DAYS = 7;

/**
 * Runs the optimiser over this week's plan and replaces the basket with the
 * result.
 *
 * Deliberately destructive: the basket is a *derived* view of the plan, so
 * regenerating must not merge with a previous run or quantities would drift
 * every time someone changes a meal. Any manual edits are lost, which is why
 * the button warns before rebuilding.
 */
export async function buildBasket(): Promise<BasketActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const [plan, recipes, pantry, staples] = await Promise.all([
    getWeeklyPlan(),
    getRecipes(),
    getPantryItems(),
    getHouseStaples(),
  ]);

  // Bin bags are not in anyone's recipe, so they have to be asked for.
  const dueStaples = staples.filter((staple) => staple.due);

  if (!plan?.id) return fail('No plan for this week yet.');
  if (plan.meals.length === 0) return fail('Plan some meals before building the basket.');

  const supabase = await createClient();

  const ingredientRows = await supabase.from('ingredients').select('*');
  if (ingredientRows.error) return fail(ingredientRows.error.message);

  // Only the ingredients this week's meals actually use need a product —
  // plus any staple that is due, which needs pricing for exactly the same
  // reason and goes through exactly the same resolver.
  const usedIds = new Set([
    ...plan.meals.flatMap((meal) => {
      const recipe = recipes.find((r) => r.id === meal.recipeId);
      return recipe ? recipe.ingredients.map((i) => i.ingredientId) : [];
    }),
    ...dueStaples.map((staple) => staple.ingredientId),
  ]);

  // Re-resolve anything uncached or stale. A price cached months ago is not a
  // price, and the split is only as honest as the numbers behind it. Search is
  // unauthenticated, so this works without the collector's Tesco session —
  // that is only needed to place the order.
  const staleBefore = Date.now() - PRICE_TTL_DAYS * 86_400_000;

  const unresolved = ingredientRows.data
    .filter((row) => {
      if (!usedIds.has(row.id)) return false;
      if (row.pack_price === null) return true;
      // Re-resolve rows that predate a column. Ingredients priced before the
      // image/product-id columns existed kept a valid pack_price, so a
      // price-only staleness check skipped them forever and their pictures
      // never appeared. Any missing piece means the cached row is incomplete.
      if (!row.image_url || !row.tesco_product_id) return true;
      if (!row.tesco_synced_at) return true;
      return new Date(row.tesco_synced_at).getTime() < staleBefore;
    })
    .map((row) => ({ ingredientId: row.id, name: row.name }));

  let resolvedCount = 0;
  if (unresolved.length > 0) {
    const resolved = await resolveIngredients(unresolved);
    for (const [ingredientId, product] of resolved) {
      const saved = await supabase
        .from('ingredients')
        .update({
          pack_size: product.packSize,
          pack_unit: product.packUnit,
          pack_price: product.packPrice,
          original_price: product.originalPrice,
          image_url: product.imageUrl,
          tesco_product_id: product.tescoProductId,
          tesco_title: product.title,
          tesco_synced_at: new Date().toISOString(),
        })
        .eq('id', ingredientId);

      if (saved.error) {
        // Do NOT swallow this. Every price in the basket, and therefore every
        // figure in the split, depends on it landing. A silent failure here
        // presents an empty basket as though Tesco simply had no matches.
        //
        // 42703 (undefined_column) means a migration has not been applied —
        // this exact case hid a broken price path behind a "success" message.
        const hint =
          saved.error.code === '42703'
            ? ' — a migration is missing. Run supabase/migrations/0006 and 0007.'
            : saved.error.code === '42501'
              ? ' — RLS denied the write. Check the ingredients_update policy in 0004.'
              : '';
        return fail(`Could not save the product found for "${product.title}": ${saved.error.message}${hint}`);
      }
      resolvedCount += 1;
    }
  }

  // Re-read so newly resolved products are included in this run.
  const refreshed =
    resolvedCount > 0 ? await supabase.from('ingredients').select('*') : ingredientRows;
  if (refreshed.error) return fail(refreshed.error.message);

  const packs: IngredientPack[] = refreshed.data.map((row) => ({
    ingredientId: row.id,
    name: row.tesco_title ?? row.name,
    category: row.category,
    packSize: row.pack_size === null ? null : Number(row.pack_size),
    packUnit: row.pack_unit,
    packPrice: row.pack_price,
    originalPrice: row.original_price,
  }));

  const productIdByIngredient = new Map(
    refreshed.data.map((row) => [row.id, row.tesco_product_id])
  );

  const imageUrlByIngredient = new Map(
    refreshed.data.map((row) => [row.id, row.image_url])
  );

  const result = optimiseBasket(plan.meals, recipes, pantry, packs);
  if (result.lines.length === 0) {
    return fail('Those meals have no ingredients recorded.');
  }

  // Replace only the DERIVED lines. Manually added items are not reproducible
  // from the plan, so wiping them would destroy the only copy.
  const cleared = await supabase
    .from('basket_items')
    .delete()
    .eq('plan_id', plan.id)
    .eq('is_manual', false);
  if (cleared.error) return fail(cleared.error.message);

  // Staples are nobody's individual order. When the house has opted in, drop
  // the per-meal attribution on household lines so they divide equally — an
  // empty allocation list is how the split expresses "everyone".
  const house = await getHouse();
  const splitStaplesEqually = house.sharedStaplesEnabled;

  // Lines with nothing left to buy (pantry covered them) are not basket items,
  // but they still counted toward pantry savings above.
  const buyable = result.lines.filter((line) => line.packs === null || line.packs > 0);

  for (const line of buyable) {
    const packDescription =
      line.packSize !== null && line.packUnit !== null
        ? `${line.packSize}${line.packUnit} pack`
        : `${line.neededQuantity}${line.unitLabel} needed`;

    const inserted = await supabase
      .from('basket_items')
      .insert({
        plan_id: plan.id,
        ingredient_id: line.ingredientId,
        tesco_product_id: productIdByIngredient.get(line.ingredientId) ?? null,
        name: line.name,
        subtitle: packDescription,
        category: line.category,
        quantity: line.packs ?? 1,
        // Unpriced lines store 0 and are shown as "price not set", never as £0.00.
        unit_price: line.unitPrice ?? 0,
        original_unit_price: line.originalUnitPrice,
        own_brand_available: line.originalUnitPrice !== null && line.originalUnitPrice > (line.unitPrice ?? 0),
        image_url: line.ingredientId ? imageUrlByIngredient.get(line.ingredientId) ?? null : null,
        packs_if_separate: line.packsIfSeparate,
        packs_from_pantry: line.packsFromPantry,
        quantity_assumed: line.quantityAssumed,
      })
      .select('id')
      .single();

    if (inserted.error || !inserted.data) {
      return fail(inserted.error?.message ?? `Could not save ${line.name}.`);
    }

    const shareEqually = splitStaplesEqually && line.category === 'household';

    if (line.allocations.length > 0 && !shareEqually) {
      const allocations = line.allocations.map((allocation) => ({
        basket_item_id: inserted.data.id,
        user_id: allocation.userId,
        // numeric(10,4) in Postgres — round to fit rather than let it reject.
        share: Math.round(allocation.share * 10000) / 10000,
      }));
      const linked = await supabase.from('basket_allocations').insert(allocations);
      if (linked.error) return fail(linked.error.message);
    }
  }

  // Due staples, added after the derived lines.
  //
  // They are not `is_manual`, so a rebuild replaces them like any other derived
  // line — the standing list, not the basket, is the source of truth. They
  // carry no allocations at all, which is how the split expresses "everyone"
  // when equal splitting is on; with it off they fall back to the same rule as
  // any other unattributed line.
  const rowById = new Map(refreshed.data.map((row) => [row.id, row]));
  let staplesAdded = 0;

  for (const staple of dueStaples) {
    const row = rowById.get(staple.ingredientId);
    if (!row) continue;

    const inserted = await supabase
      .from('basket_items')
      .insert({
        plan_id: plan.id,
        ingredient_id: row.id,
        tesco_product_id: row.tesco_product_id,
        name: row.tesco_title ?? row.name,
        subtitle: 'House staple',
        // Forced, not read from the row: the equal-split rule keys on this and
        // a staple miscategorised as food would be charged to one person.
        category: 'household',
        quantity: 1,
        unit_price: row.pack_price ?? 0,
        original_unit_price: row.original_price,
        own_brand_available:
          row.original_price !== null && row.original_price > (row.pack_price ?? 0),
        image_url: row.image_url,
      })
      .select('id')
      .single();

    if (inserted.error) return fail(`Could not add staple ${staple.name}: ${inserted.error.message}`);

    // Only stamp the date once the line is really in the basket, so a failed
    // build cannot push a staple a fortnight into the future.
    const stamped = await supabase
      .from('house_staples')
      .update({ last_added_on: new Date().toISOString().slice(0, 10) })
      .eq('id', staple.id);
    if (stamped.error) return fail(`Could not record ${staple.name} as added: ${stamped.error.message}`);

    staplesAdded += 1;
  }

  // Savings are recomputed from the same run, so the banner can never drift
  // away from the basket it describes.
  await supabase
    .from('weekly_plans')
    .update({ shared_savings: result.overlapSavings + result.pantrySavings })
    .eq('id', plan.id);

  revalidatePath('/basket');
  revalidatePath('/split');
  revalidatePath('/plan');
  revalidatePath('/');

  // NOTE: rebuilding deliberately does NOT push to Tesco.
  //
  // It used to auto-call syncBasketToTesco() and startTescoCheckout() whenever a
  // session existed. Three problems, all of them surprising for a button whose
  // label is "Rebuild basket":
  //
  //   1. It wrote to the collector's real Tesco trolley as a side effect of a
  //      local recalculation.
  //   2. syncBasketToTesco sets weekly_plans.status = 'ordered', which locks
  //      planning — so recomputing the shopping list silently ended the week.
  //   3. startTescoCheckout drives Playwright with `headless: false`, so a
  //      browser window opened on the collector's machine every rebuild.
  //
  // Pushing to Tesco is an outward-facing action with real consequences and
  // stays behind the explicit Checkout button.

  const unpriced = result.needsPackData.length;
  const stapleNote =
    staplesAdded === 0
      ? ''
      : ` Plus ${staplesAdded} house staple${staplesAdded === 1 ? '' : 's'} that came due.`;
  return {
    status: 'built',
    message:
      unpriced === 0
        ? `Basket built: ${buyable.length} items.${stapleNote}`
        : `Basket built: ${buyable.length} items.${stapleNote} ${unpriced} need pack size and price before they can be split.`,
  };
}

/** Records pack size/unit/price for one ingredient, then rebuilds the basket. */
export async function saveIngredientPack(
  _prev: BasketActionState,
  formData: FormData
): Promise<BasketActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const ingredientId = String(formData.get('ingredientId') ?? '');
  if (!ingredientId) return fail('Missing ingredient.');

  const size = Number.parseFloat(String(formData.get('packSize') ?? ''));
  const unit = String(formData.get('packUnit') ?? '').trim();
  const price = parsePounds(String(formData.get('packPrice') ?? ''));

  if (!Number.isFinite(size) || size <= 0) return fail('Pack size must be a positive number.');
  if (!unit) return fail('Give the pack a unit, e.g. g, ml, tin.');
  if (price === null || price < 0) return fail('Enter the pack price, e.g. 1.20.');

  const supabase = await createClient();
  const result = await supabase
    .from('ingredients')
    .update({ pack_size: size, pack_unit: unit, pack_price: price })
    .eq('id', ingredientId);

  if (result.error) return fail(result.error.message);

  // Re-run so the basket reflects the new price immediately.
  return buildBasket();
}

/** Updates the quantity of an item in the basket. Deletes if quantity <= 0. */
export async function updateBasketItemQuantity(
  basketItemId: string,
  quantity: number
): Promise<BasketActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const supabase = await createClient();

  if (quantity <= 0) {
    const deleted = await supabase.from('basket_items').delete().eq('id', basketItemId);
    if (deleted.error) return fail(deleted.error.message);
  } else {
    const updated = await supabase
      .from('basket_items')
      .update({ quantity })
      .eq('id', basketItemId);
    if (updated.error) return fail(updated.error.message);
  }

  revalidatePath('/basket');
  revalidatePath('/split');
  revalidatePath('/plan');
  revalidatePath('/');

  return { status: 'built', message: 'Basket updated.' };
}

export async function searchTescoProducts(query: string): Promise<any[]> {
  try {
    const provider = new TescoProvider();
    const results = await provider.search(query, { limit: 8 });
    return results.map((p) => ({
      product_uid: p.product_uid,
      name: p.name,
      price: Math.round(p.retail_price.price * 100),
      size: p.size || p.unit_price?.measure || 'each',
      imageUrl: p.image_url || null,
    }));
  } catch (err) {
    return [];
  }
}

export async function updateIngredientProductMapping(
  basketItemId: string,
  ingredientId: string | null,
  productUid: string,
  name: string,
  subtitle: string,
  unitPrice: number,
  imageUrl: string | null
): Promise<BasketActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const supabase = await createClient();

  const basketUpdate = await supabase
    .from('basket_items')
    .update({
      tesco_product_id: productUid,
      name,
      subtitle,
      unit_price: unitPrice,
      image_url: imageUrl,
    })
    .eq('id', basketItemId);

  if (basketUpdate.error) return fail(basketUpdate.error.message);

  if (ingredientId) {
    let packSize = 1;
    let packUnit = 'each';
    const match = subtitle.match(/([\d.]+)\s*(\w+)/);
    if (match) {
      packSize = parseFloat(match[1]);
      packUnit = match[2];
    }

    const ingredientUpdate = await supabase
      .from('ingredients')
      .update({
        tesco_product_id: productUid,
        tesco_title: name,
        pack_size: packSize,
        pack_unit: packUnit,
        pack_price: unitPrice,
        image_url: imageUrl,
        tesco_synced_at: new Date().toISOString(),
      })
      .eq('id', ingredientId);

    if (ingredientUpdate.error) return fail(ingredientUpdate.error.message);
  }

  revalidatePath('/basket');
  revalidatePath('/split');
  revalidatePath('/');

  return { status: 'built', message: 'Brand successfully swapped!' };
}


/**
 * Adds an item the recipes did not produce — washing-up liquid, snacks, milk
 * for tea. Without this there is no way to buy anything that is not an
 * ingredient, and the house needs a second shopping list.
 *
 * Marked `is_manual` so a rebuild preserves it: the basket is otherwise
 * regenerated destructively from the plan, and this row cannot be recreated.
 */
export async function addManualItem(
  _prev: BasketActionState,
  formData: FormData
): Promise<BasketActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const plan = await getWeeklyPlan();
  if (!plan?.id) return fail('No plan for this week yet.');

  const productId = String(formData.get('productId') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const price = Number.parseInt(String(formData.get('price') ?? ''), 10);
  const subtitle = String(formData.get('subtitle') ?? '').trim();
  const imageUrl = String(formData.get('imageUrl') ?? '').trim() || null;
  const quantity = Math.max(1, Number.parseInt(String(formData.get('quantity') ?? '1'), 10) || 1);

  if (!name) return fail('Pick a product to add.');
  if (!Number.isFinite(price) || price < 0) return fail('That product has no usable price.');

  const supabase = await createClient();
  const inserted = await supabase.from('basket_items').insert({
    plan_id: plan.id,
    ingredient_id: null,
    tesco_product_id: productId || null,
    name,
    subtitle: subtitle || 'Added by hand',
    // Household so it rides with the shared-staples rule; nobody's recipe
    // asked for it, so it is everyone's by default.
    category: 'household',
    quantity,
    unit_price: price,
    image_url: imageUrl,
    is_manual: true,
  });

  if (inserted.error) {
    const hint =
      inserted.error.code === '42703'
        ? ' — run supabase/migrations/0011_manual_basket_items.sql.'
        : '';
    return fail(`Could not add ${name}: ${inserted.error.message}${hint}`);
  }

  revalidatePath('/basket');
  revalidatePath('/split');
  return { status: 'built', message: `Added ${name}. It will survive a rebuild.` };
}

/** Removes a manually added item. Derived lines go by rebuilding instead. */
export async function removeManualItem(itemId: string): Promise<BasketActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const supabase = await createClient();
  const removed = await supabase
    .from('basket_items')
    .delete()
    .eq('id', itemId)
    .eq('is_manual', true);

  if (removed.error) return fail(removed.error.message);

  revalidatePath('/basket');
  revalidatePath('/split');
  return { status: 'built', message: 'Removed.' };
}
