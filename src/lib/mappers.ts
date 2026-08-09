/**
 * Postgres row shapes → domain types.
 *
 * Kept separate from `queries.ts` so the mapping is testable without a client,
 * and so the snake_case/camelCase boundary lives in exactly one file.
 */

import type { Database } from './supabase/database.types';
import type {
  Allocation,
  BasketItem,
  House,
  LedgerEntry,
  PantryItem,
  PlannedMeal,
  Recipe,
  RecipeIngredient,
  Split,
  Substitution,
  User,
  WeeklyPlan,
} from './types';

type Tables = Database['public']['Tables'];
type HouseRow = Tables['houses']['Row'];
type ProfileRow = Tables['profiles']['Row'];
type RecipeRow = Tables['recipes']['Row'];
type RecipeIngredientRow = Tables['recipe_ingredients']['Row'];
type IngredientRow = Tables['ingredients']['Row'];
type WeeklyPlanRow = Tables['weekly_plans']['Row'];
type PlannedMealRow = Tables['planned_meals']['Row'];
type MealParticipantRow = Tables['meal_participants']['Row'];
type BasketItemRow = Tables['basket_items']['Row'];
type BasketAllocationRow = Tables['basket_allocations']['Row'];
type SplitRow = Tables['splits']['Row'];
type PantryItemRow = Tables['pantry_items']['Row'];
type SubstitutionRow = Tables['substitutions']['Row'];

export function toHouse(row: HouseRow): House {
  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    deliveryDay: row.delivery_day,
    // Postgres `time` comes back as HH:MM:SS; the UI only ever shows HH:MM.
    deliveryTime: row.delivery_time.slice(0, 5),
    cutoffDay: row.cutoff_day,
    cutoffTime: row.cutoff_time.slice(0, 5),
    collectorUserId: row.collector_user_id ?? '',
    sharedStaplesEnabled: row.shared_staples_enabled,
    fulfillmentMethod: row.fulfillment_method,
    slotPreference: {
      method: row.preferred_fulfillment_method,
      day: row.preferred_day,
      // Postgres `time` returns HH:MM:SS; the UI and matcher work in HH:MM.
      windowStart: row.preferred_window_start ? row.preferred_window_start.slice(0, 5) : null,
      windowEnd: row.preferred_window_end ? row.preferred_window_end.slice(0, 5) : null,
    },
    deliveryPostcode: row.delivery_postcode,
    clickCollectStore: row.click_collect_store,
  };
}

export function toUser(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    houseId: row.house_id ?? '',
    room: row.room,
    avatarUrl: row.avatar_url,
    accent: row.accent,
    dietaryPreferences: row.dietary_preferences,
    paymentDetailsText: row.payment_details_text,
    isAdmin: row.is_admin,
  };
}

export function toRecipeIngredient(
  row: RecipeIngredientRow,
  ingredient: IngredientRow,
  stockedIngredientIds: ReadonlySet<string>
): RecipeIngredient {
  return {
    ingredientId: row.ingredient_id,
    name: ingredient.name,
    quantity: Number(row.quantity),
    unit: row.unit,
    category: ingredient.category,
    inPantry: stockedIngredientIds.has(row.ingredient_id),
  };
}

export function toRecipe(row: RecipeRow, ingredients: RecipeIngredient[]): Recipe {
  return {
    id: row.id,
    title: row.title,
    sourceUrl: row.source_url,
    imageUrl: row.image_url,
    cookTimeMins: row.cook_time_mins,
    difficulty: row.difficulty,
    servings: row.servings,
    costPerPortion: row.cost_per_portion,
    tags: row.tags,
    instructions: row.instructions,
    proTip: row.pro_tip,
    ingredients,
  };
}

export function toPlannedMeal(
  row: PlannedMealRow,
  recipeTitle: string,
  participants: MealParticipantRow[]
): PlannedMeal {
  return {
    id: row.id,
    planId: row.plan_id,
    recipeId: row.recipe_id,
    recipeTitle,
    day: row.day,
    mealType: row.meal_type,
    isShared: row.is_shared,
    cookedByUserId: row.cooked_by_user_id,
    participants: participants
      .filter((participant) => !participant.opted_out)
      .map((participant) => ({ userId: participant.user_id })),
  };
}

export function toWeeklyPlan(row: WeeklyPlanRow, meals: PlannedMeal[]): WeeklyPlan {
  return {
    // A slot needs both an id and a charge to be usable: charge 0 is a real
    // free collection slot, so only null means "not chosen".
    slot:
      row.slot_id && row.slot_charge !== null
        ? {
            id: row.slot_id,
            method: row.slot_method ?? 'delivery',
            startsAt: row.slot_starts_at,
            endsAt: row.slot_ends_at,
            charge: row.slot_charge,
          }
        : null,
    id: row.id,
    houseId: row.house_id,
    weekStartDate: row.week_start_date,
    weekNumber: row.week_number,
    status: row.status,
    cutoffAt: row.cutoff_at,
    sharedSavings: row.shared_savings,
    meals,
    // Conflicts are derived, not stored — see detectConflicts() in conflicts.ts.
    conflicts: [],
  };
}

export function toBasketItem(
  row: BasketItemRow,
  allocations: BasketAllocationRow[],
  needsPackData = false
): BasketItem {
  const allocatedTo: Allocation[] = allocations.map((allocation) => ({
    userId: allocation.user_id,
    share: Number(allocation.share),
  }));

  return {
    id: row.id,
    planId: row.plan_id,
    ingredientId: row.ingredient_id,
    packsIfSeparate: row.packs_if_separate,
    packsFromPantry: row.packs_from_pantry,
    needsPackData,
    tescoProductId: row.tesco_product_id ?? '',
    name: row.name,
    subtitle: row.subtitle,
    imageUrl: row.image_url,
    category: row.category,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    originalUnitPrice: row.original_unit_price,
    ownBrandAvailable: row.own_brand_available,
    allocatedTo,
  };
}

export function toSplit(row: SplitRow, lines: Split['lines']): Split {
  return {
    id: row.id,
    planId: row.plan_id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    amount: row.amount,
    status: row.status,
    lines,
  };
}

export function toLedgerEntry(row: SplitRow, weekNumber: number): LedgerEntry {
  return {
    id: row.id,
    houseId: '',
    weekNumber,
    date: row.created_at.slice(0, 10),
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    amount: row.amount,
    status: row.status,
    note: row.note,
  };
}

export function toPantryItem(row: PantryItemRow, ingredient: IngredientRow): PantryItem {
  return {
    id: row.id,
    houseId: row.house_id,
    ingredientId: row.ingredient_id,
    name: ingredient.name,
    category: ingredient.category,
    quantityRemaining: Number(row.quantity_remaining),
    unit: row.unit,
    addedDate: row.added_date,
    isShared: row.is_shared,
    ownerUserId: row.owner_user_id,
    lowStock: row.low_stock,
  };
}

export function toSubstitution(row: SubstitutionRow): Substitution {
  return {
    id: row.id,
    basketItemId: row.basket_item_id,
    orderedName: row.ordered_name,
    orderedPrice: row.ordered_price,
    receivedName: row.received_name,
    receivedPrice: row.received_price,
    decision: row.decision,
  };
}
