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
  is_admin: boolean;
  created_at: string;
}

type IngredientRow = {
  id: string;
  name: string;
  default_unit: string;
  category: IngredientCategory;
  // Pack data for the optimiser; null until the house records it.
  pack_size: number | null;
  pack_unit: string | null;
  pack_price: number | null;
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
}

type PlannedMealRow = {
  id: string;
  plan_id: string;
  recipe_id: string;
  day: Weekday;
  meal_type: MealType;
  is_shared: boolean;
  cooked_by_user_id: string | null;
}

type MealParticipantRow = {
  planned_meal_id: string;
  user_id: string;
  opted_out: boolean;
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
  // Provenance written by the optimiser, so savings can be explained.
  ingredient_id: string | null;
  packs_if_separate: number | null;
  packs_from_pantry: number | null;
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
      houses: TableDef<HouseRow, Insertable<HouseRow, 'id' | 'invite_code' | 'created_at' | 'delivery_day' | 'delivery_time' | 'cutoff_day' | 'cutoff_time' | 'collector_user_id' | 'shared_staples_enabled'>>;
      profiles: TableDef<ProfileRow, Insertable<ProfileRow, 'created_at' | 'house_id' | 'room' | 'avatar_url' | 'accent' | 'dietary_preferences' | 'payment_details_text' | 'is_admin'>>;
      ingredients: TableDef<IngredientRow, Insertable<IngredientRow, 'id' | 'default_unit' | 'category' | 'pack_size' | 'pack_unit' | 'pack_price' | 'tesco_product_id' | 'tesco_title' | 'tesco_synced_at'>>;
      recipes: TableDef<RecipeRow, Insertable<RecipeRow, 'id' | 'created_at' | 'house_id' | 'created_by' | 'source_url' | 'image_url' | 'cook_time_mins' | 'difficulty' | 'servings' | 'cost_per_portion' | 'tags' | 'instructions' | 'pro_tip'>>;
      recipe_ingredients: TableDef<RecipeIngredientRow, RecipeIngredientRow>;
      weekly_plans: TableDef<WeeklyPlanRow, Insertable<WeeklyPlanRow, 'id' | 'created_at' | 'status' | 'shared_savings'>>;
      planned_meals: TableDef<PlannedMealRow, Insertable<PlannedMealRow, 'id' | 'meal_type' | 'is_shared' | 'cooked_by_user_id'>>;
      meal_participants: TableDef<MealParticipantRow, Insertable<MealParticipantRow, 'opted_out'>>;
      basket_items: TableDef<BasketItemRow, Insertable<BasketItemRow, 'id' | 'created_at' | 'tesco_product_id' | 'subtitle' | 'image_url' | 'category' | 'quantity' | 'original_unit_price' | 'own_brand_available' | 'ingredient_id' | 'packs_if_separate' | 'packs_from_pantry'>>;
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
