/**
 * Core data model — mirrors the schema in CLAUDE.md.
 * All monetary values are integer pence. Never store pounds as floats.
 */

export type Pence = number;

export type PlanStatus = 'planning' | 'locked' | 'ordered' | 'delivered';
export type SplitStatus = 'pending' | 'notified' | 'confirmed' | 'disputed';
export type IngredientCategory = 'fresh' | 'cupboard' | 'frozen' | 'household';
export type MealType = 'breakfast' | 'lunch' | 'dinner';
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export interface House {
  id: string;
  name: string;
  inviteCode: string;
  deliveryDay: Weekday;
  deliveryTime: string;
  cutoffDay: Weekday;
  cutoffTime: string;
  collectorUserId: string;
  sharedStaplesEnabled: boolean;
  fulfillmentMethod: 'collect' | 'delivery';
  deliveryPostcode: string | null;
  clickCollectStore: string;
  /**
   * Optional slot preference. Every field may be null — this only ever
   * *suggests* a slot; the collector still selects one explicitly.
   */
  slotPreference: {
    method: 'delivery' | 'collect' | null;
    day: Weekday | null;
    windowStart: string | null;
    windowEnd: string | null;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  houseId: string;
  room: string | null;
  avatarUrl: string | null;
  /** Tailwind-ready accent used for the initials fallback avatar. */
  accent: 'green' | 'orange' | 'blue' | 'purple';
  dietaryPreferences: string[];
  /** Free text — the app never processes payments, it only displays details. */
  paymentDetailsText: string | null;
  isAdmin: boolean;
}

export interface Ingredient {
  id: string;
  name: string;
  defaultUnit: string;
  category: IngredientCategory;
}

export interface RecipeIngredient {
  ingredientId: string;
  name: string;
  quantity: number;
  unit: string;
  category: IngredientCategory;
  /** True when the pantry already covers this, so it stays out of the basket. */
  inPantry: boolean;
}

export interface Recipe {
  id: string;
  title: string;
  sourceUrl: string | null;
  imageUrl: string | null;
  cookTimeMins: number;
  difficulty: 'easy' | 'medium' | 'hard';
  servings: number;
  costPerPortion: Pence;
  tags: string[];
  instructions: string[];
  proTip: string | null;
  ingredients: RecipeIngredient[];
}

export interface MealParticipant {
  userId: string;
  /** Set when this housemate opted out of an otherwise-shared meal. */
  optedOut?: boolean;
}

export interface PlannedMeal {
  id: string;
  planId: string;
  recipeId: string;
  recipeTitle: string;
  day: Weekday;
  mealType: MealType;
  isShared: boolean;
  cookedByUserId: string | null;
  participants: MealParticipant[];
}

/** Two housemates on the same day picked meals that share no ingredients. */
export interface PlanConflict {
  day: Weekday;
  userIds: string[];
  message: string;
  /** Negative pence — savings forfeited by not converging on one meal. */
  savingsImpact: Pence;
}

export interface WeeklyPlan {
  id: string;
  houseId: string;
  weekStartDate: string;
  weekNumber: number;
  status: PlanStatus;
  cutoffAt: string;
  meals: PlannedMeal[];
  conflicts: PlanConflict[];
  sharedSavings: Pence;
  /**
   * The booked delivery/collection slot, if one has been chosen.
   * `charge` is integer pence; 0 is a real free slot, null means unchosen.
   */
  slot: {
    id: string;
    method: 'delivery' | 'collect';
    startsAt: string | null;
    endsAt: string | null;
    charge: Pence;
  } | null;
}

/** How one basket line is divided. Shares are relative weights, not fractions. */
export interface Allocation {
  userId: string;
  share: number;
}

export interface BasketItem {
  id: string;
  planId: string;
  /** Set when the optimiser produced this line; null for manual additions. */
  ingredientId: string | null;
  /** Packs the house would have bought if every meal shopped separately. */
  packsIfSeparate: number | null;
  /** Packs avoided because the pantry already covered part of the need. */
  packsFromPantry: number | null;
  /** True when pack price is unrecorded, so this line cannot be split yet. */
  needsPackData: boolean;
  tescoProductId: string;
  name: string;
  /** Pack size / brand line, e.g. "Barilla, 500g". */
  subtitle: string;
  imageUrl: string | null;
  category: IngredientCategory;
  quantity: number;
  unitPrice: Pence;
  /** Set when an own-brand swap is available; the pre-swap price. */
  originalUnitPrice: Pence | null;
  ownBrandAvailable: boolean;
  /** Empty allocation array means "shared equally across the whole house". */
  allocatedTo: Allocation[];
}

export interface SplitLine {
  label: string;
  detail: string;
  amount: Pence;
  /** Shown verbatim under the line to make the arithmetic auditable. */
  workings: { label: string; value: string }[];
  icon: string;
}

export interface Split {
  id: string;
  planId: string;
  fromUserId: string;
  toUserId: string;
  amount: Pence;
  status: SplitStatus;
  lines: SplitLine[];
}

export interface LedgerEntry {
  id: string;
  houseId: string;
  weekNumber: number;
  date: string;
  fromUserId: string;
  toUserId: string;
  amount: Pence;
  status: SplitStatus;
  note: string;
}

export interface PantryItem {
  id: string;
  houseId: string;
  ingredientId: string;
  name: string;
  category: IngredientCategory;
  quantityRemaining: number;
  unit: string;
  addedDate: string;
  isShared: boolean;
  ownerUserId: string | null;
  lowStock: boolean;
}

export type SubstitutionDecision = 'pending' | 'accepted' | 'rejected';

export interface Substitution {
  id: string;
  basketItemId: string;
  orderedName: string;
  orderedPrice: Pence;
  receivedName: string;
  receivedPrice: Pence;
  decision: SubstitutionDecision;
}

/**
 * Only what we can evidence from real basket rows.
 *
 * There is no "bulk buying" or "pantry reuse" figure and no comparison against
 * other households: attributing those needs the optimiser to record why each
 * choice was made, and we hold no data on other houses. A number we cannot
 * derive does not get a field here.
 */
export interface Savings {
  totalAllTime: Pence;
  thisWeek: Pence;
  ownBrandSwaps: { label: string; amount: Pence }[];
}

export interface ReconciliationItem {
  basketItemId: string;
  name: string;
  expectedQuantity: number;
  receivedQuantity: number;
  price: Pence;
  received: boolean;
}
