/**
 * Hand-maintained mirror of supabase/migrations/*.sql.
 *
 * Once a Supabase project exists, regenerate instead of editing:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 *
 * TWO RULES if you do edit this by hand. Break either one and supabase-js
 * silently types every query result as `never[]` — no error points here.
 *
 *  1. Row types must be `type X = { … }`, never `interface X { … }`.
 *     supabase-js constrains rows to `Record<string, unknown>`. TypeScript
 *     gives type aliases an implicit index signature but deliberately withholds
 *     one from interfaces (an interface can be augmented later, so its keys are
 *     not closed). An interface therefore fails the constraint.
 *
 *  2. Empty groups must be `{ [_ in never]: never }`, never `Record<string, never>`.
 *     The latter carries a string index signature, so the select-query parser
 *     finds every table name in `Views` and resolves it to `never`.
 */

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type MealType = 'breakfast' | 'lunch' | 'dinner';
export type PlanStatus = 'planning' | 'locked' | 'ordered' | 'delivered';
export type SplitStatus = 'pending' | 'notified' | 'confirmed' | 'disputed';
export type IngredientCategory = 'fresh' | 'cupboard' | 'frozen' | 'household';
export type SubstitutionDecision = 'pending' | 'accepted' | 'rejected';
export type RecipeDifficulty = 'easy' | 'medium' | 'hard';
export type AvatarAccent = 'green' | 'orange' | 'blue' | 'purple';
export type MealStatus = 'planned' | 'cooked' | 'skipped' | 'swapped';
export type StapleFrequency = 'weekly' | 'fortnightly' | 'monthly';

type HouseRow = {
  id: string;
  name: string;
  invite_code: string;
  delivery_day: Weekday;
  delivery_time: string;
  cutoff_day: Weekday;
  cutoff_time: string;
  collector_user_id: string | null;
  shared_staples_enabled: boolean;
  fulfillment_method: 'collect' | 'delivery';
  delivery_postcode: string | null;
  click_collect_store: string;
  // Optional slot preferences (migration 0010). All nullable — a house that
  // never sets these still gets a fully usable picker.
  preferred_fulfillment_method: 'delivery' | 'collect' | null;
  preferred_day: Weekday | null;
  preferred_window_start: string | null;
  preferred_window_end: string | null;
  created_at: string;
}

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  house_id: string | null;
  room: string | null;
  avatar_url: string | null;
  accent: AvatarAccent;
  dietary_preferences: string[];
  payment_details_text: string | null;
  /** True for seeded placeholder housemates. They have no auth.users row. */
  is_demo: boolean;
  // Structured payment fields (migration 0012).
  payment_bank_name: string | null;
  payment_sort_code: string | null;
  payment_account_number: string | null;
  payment_link: string | null;
  is_admin: boolean;
  created_at: string;
}

type IngredientRow = {
  id: string;
  name: string;
  /** Normalised match key — see src/lib/ingredients.ts canonicalName(). */
  canonical_name: string | null;
  default_unit: string;
  category: IngredientCategory;
  // Pack data for the optimiser; null until the house records it.
  pack_size: number | null;
  pack_unit: string | null;
  pack_price: number | null;
  original_price: number | null;
  image_url: string | null;
  // Which Tesco product the pack figures came from (migration 0004).
  tesco_product_id: string | null;
  tesco_title: string | null;
  tesco_synced_at: string | null;
}

type RecipeRow = {
  id: string;
  house_id: string | null;
  created_by: string | null;
  title: string;
  source_url: string | null;
  image_url: string | null;
  cook_time_mins: number;
  difficulty: RecipeDifficulty;
  servings: number;
  cost_per_portion: number;
  tags: string[];
  instructions: string[];
  pro_tip: string | null;
  created_at: string;
}

type RecipeIngredientRow = {
  recipe_id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
}

type WeeklyPlanRow = {
  id: string;
  house_id: string;
  week_start_date: string;
  week_number: number;
  status: PlanStatus;
  cutoff_at: string;
  shared_savings: number;
  created_at: string;
  // Booked delivery/collection slot (migration 0009).
  slot_id: string | null;
  slot_method: 'delivery' | 'collect' | null;
  slot_starts_at: string | null;
  slot_ends_at: string | null;
  /** Charge in integer pence. Null = no slot chosen; 0 = chosen and free. */
  slot_charge: number | null;
}

type PlannedMealRow = {
  id: string;
  plan_id: string;
  recipe_id: string;
  day: Weekday;
  meal_type: MealType;
  is_shared: boolean;
  cooked_by_user_id: string | null;
  /** Asked to take the cooking, not yet answered. Null = nothing pending. */
  cook_offer_to: string | null;
  status: MealStatus;
  /** Mouths this meal is cooked for. Null = open to anyone. */
  max_diners: number | null;
  /** Who put the meal on the plan. Owns the capacity setting. */
  created_by: string | null;
}

type MealParticipantRow = {
  planned_meal_id: string;
  user_id: string;
  /** Left before the order: the food was never bought, cost never accrued. */
  opted_out: boolean;
  /** Left after the order: the food exists, is theirs, and stays on their bill. */
  bailed: boolean;
  /** Extra mouths this person is bringing. */
  guests: number;
  /** True: the host pays for their guests. False: the table splits them. */
  guests_covered: boolean;
}

type ExpenseRow = {
  id: string;
  house_id: string;
  paid_by_user_id: string;
  description: string;
  amount: number;
  spent_on: string;
  note: string;
  created_at: string;
}

type ExpenseShareRow = {
  expense_id: string;
  user_id: string;
  amount: number;
  settled: boolean;
}

type LeftoverRow = {
  id: string;
  house_id: string;
  created_by: string;
  description: string;
  portions: number;
  made_on: string;
  eat_by: string;
  created_at: string;
}

type HouseStapleRow = {
  id: string;
  house_id: string;
  ingredient_id: string;
  frequency: StapleFrequency;
  last_added_on: string | null;
  created_at: string;
}

type BasketItemRow = {
  id: string;
  plan_id: string;
  tesco_product_id: string | null;
  name: string;
  subtitle: string;
  image_url: string | null;
  category: IngredientCategory;
  quantity: number;
  unit_price: number;
  original_unit_price: number | null;
  own_brand_available: boolean;
  created_at: string;
  /** One pack assumed because the pack count could not be derived. */
  quantity_assumed: boolean;
  // Provenance written by the optimiser, so savings can be explained.
  ingredient_id: string | null;
  packs_if_separate: number | null;
  packs_from_pantry: number | null;
  /** Added by hand rather than derived; survives a rebuild. */
  is_manual: boolean;
}

type BasketAllocationRow = {
  basket_item_id: string;
  user_id: string;
  share: number;
}

type SplitRow = {
  id: string;
  plan_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  status: SplitStatus;
  note: string;
  created_at: string;
}

type PantryItemRow = {
  id: string;
  house_id: string;
  ingredient_id: string;
  quantity_remaining: number;
  unit: string;
  added_date: string;
  is_shared: boolean;
  owner_user_id: string | null;
  low_stock: boolean;
}

type SubstitutionRow = {
  id: string;
  basket_item_id: string;
  ordered_name: string;
  ordered_price: number;
  received_name: string;
  received_price: number;
  decision: SubstitutionDecision;
}

type DeliveryReceiptRow = {
  basket_item_id: string;
  received: boolean;
  received_quantity: number;
  recorded_at: string;
}

/** Insert/Update shapes: generated columns and defaults become optional. */
type Insertable<T, Optional extends keyof T> = Omit<T, Optional> & Partial<Pick<T, Optional>>;

/**
 * Assembles one table entry. `Relationships` is required by supabase-js's
 * `GenericTable` constraint — omit it and the whole schema silently fails the
 * constraint, collapsing every row type to `never`. We declare no relationships
 * because nothing here uses PostgREST's embedded-resource syntax; joins are
 * done explicitly in queries.ts.
 */
type TableDef<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    // GenericSchema requires Tables, Views and Functions; Views must be present
    // even though we define none. See rule 2 in the header comment.
    Views: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
    Tables: {
      houses: TableDef<HouseRow, Insertable<HouseRow, 'id' | 'invite_code' | 'created_at' | 'delivery_day' | 'delivery_time' | 'cutoff_day' | 'cutoff_time' | 'collector_user_id' | 'shared_staples_enabled' | 'fulfillment_method' | 'delivery_postcode' | 'click_collect_store' | 'preferred_fulfillment_method' | 'preferred_day' | 'preferred_window_start' | 'preferred_window_end'>>;
      profiles: TableDef<ProfileRow, Insertable<ProfileRow, 'created_at' | 'house_id' | 'room' | 'avatar_url' | 'accent' | 'dietary_preferences' | 'payment_details_text' | 'payment_bank_name' | 'payment_sort_code' | 'payment_account_number' | 'payment_link' | 'is_admin' | 'is_demo'>>;
      ingredients: TableDef<IngredientRow, Insertable<IngredientRow, 'id' | 'canonical_name' | 'default_unit' | 'category' | 'pack_size' | 'pack_unit' | 'pack_price' | 'original_price' | 'image_url' | 'tesco_product_id' | 'tesco_title' | 'tesco_synced_at'>>;
      recipes: TableDef<RecipeRow, Insertable<RecipeRow, 'id' | 'created_at' | 'house_id' | 'created_by' | 'source_url' | 'image_url' | 'cook_time_mins' | 'difficulty' | 'servings' | 'cost_per_portion' | 'tags' | 'instructions' | 'pro_tip'>>;
      recipe_ingredients: TableDef<RecipeIngredientRow, RecipeIngredientRow>;
      weekly_plans: TableDef<WeeklyPlanRow, Insertable<WeeklyPlanRow, 'id' | 'created_at' | 'status' | 'shared_savings' | 'slot_id' | 'slot_method' | 'slot_starts_at' | 'slot_ends_at' | 'slot_charge'>>;
      planned_meals: TableDef<PlannedMealRow, Insertable<PlannedMealRow, 'id' | 'meal_type' | 'is_shared' | 'cooked_by_user_id' | 'cook_offer_to' | 'status' | 'max_diners' | 'created_by'>>;
      meal_participants: TableDef<MealParticipantRow, Insertable<MealParticipantRow, 'opted_out' | 'bailed' | 'guests' | 'guests_covered'>>;
      expenses: TableDef<ExpenseRow, Insertable<ExpenseRow, 'id' | 'created_at' | 'spent_on' | 'note'>>;
      expense_shares: TableDef<ExpenseShareRow, Insertable<ExpenseShareRow, 'settled'>>;
      leftovers: TableDef<LeftoverRow, Insertable<LeftoverRow, 'id' | 'created_at' | 'portions' | 'made_on'>>;
      house_staples: TableDef<HouseStapleRow, Insertable<HouseStapleRow, 'id' | 'created_at' | 'frequency' | 'last_added_on'>>;
      basket_items: TableDef<BasketItemRow, Insertable<BasketItemRow, 'id' | 'created_at' | 'tesco_product_id' | 'subtitle' | 'image_url' | 'category' | 'quantity' | 'original_unit_price' | 'own_brand_available' | 'ingredient_id' | 'packs_if_separate' | 'packs_from_pantry' | 'is_manual' | 'quantity_assumed'>>;
      basket_allocations: TableDef<BasketAllocationRow, Insertable<BasketAllocationRow, 'share'>>;
      splits: TableDef<SplitRow, Insertable<SplitRow, 'id' | 'created_at' | 'status' | 'note'>>;
      pantry_items: TableDef<PantryItemRow, Insertable<PantryItemRow, 'id' | 'quantity_remaining' | 'unit' | 'added_date' | 'is_shared' | 'owner_user_id' | 'low_stock'>>;
      substitutions: TableDef<SubstitutionRow, Insertable<SubstitutionRow, 'id' | 'decision'>>;
      delivery_receipts: TableDef<DeliveryReceiptRow, Insertable<DeliveryReceiptRow, 'received' | 'received_quantity' | 'recorded_at'>>;
    };
    Functions: {
      join_house: { Args: { p_invite_code: string }; Returns: string | null };
      create_house: {
        Args: {
          p_name: string;
          p_delivery_day?: Weekday;
          p_cutoff_day?: Weekday;
          p_cutoff_time?: string;
        };
        Returns: HouseRow;
      };
      current_house_id: { Args: Record<string, never>; Returns: string | null };
      seed_demo_housemates: { Args: { p_names: string[] }; Returns: number };
      remove_demo_housemates: { Args: Record<string, never>; Returns: number };
      // SECURITY DEFINER, migration 0020. Each returns the number of rows it
      // changed, so a zero can be reported rather than passing for success.
      demo_set_split_status: {
        Args: { p_split_id: string; p_status: SplitStatus; p_acting_as: string };
        Returns: number;
      };
      demo_update_payment_details: {
        Args: {
          p_target: string;
          p_bank_name: string | null;
          p_sort_code: string | null;
          p_account_number: string | null;
          p_payment_link: string | null;
          p_note: string | null;
        };
        Returns: number;
      };
      demo_update_dietary: { Args: { p_target: string; p_dietary: string[] }; Returns: number };
      delete_house: { Args: { p_house_id: string }; Returns: number };
    };
    Enums: {
      weekday: Weekday;
      meal_type: MealType;
      plan_status: PlanStatus;
      split_status: SplitStatus;
      ingredient_category: IngredientCategory;
      substitution_decision: SubstitutionDecision;
      recipe_difficulty: RecipeDifficulty;
      avatar_accent: AvatarAccent;
    };
  };
};
