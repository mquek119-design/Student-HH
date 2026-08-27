/**
 * Core data model — mirrors the schema in CLAUDE.md.
 * All monetary values are integer pence. Never store pounds as floats.
 */

export type Pence = number;

export type PlanStatus = 'planning' | 'locked' | 'ordered' | 'delivered';
export type SplitStatus = 'pending' | 'notified' | 'confirmed' | 'disputed';
export type IngredientCategory = 'fresh' | 'cupboard' | 'frozen' | 'household';
export type MealType = 'breakfast' | 'lunch' | 'dinner';
/**
 * Where a meal is in its life. `planned` until the night happens; after that a
 * diner records what actually occurred. None of these move money — the food was
 * bought and paid for whatever anyone did with it.
 */
export type MealStatus = 'planned' | 'cooked' | 'skipped' | 'swapped';
export type StapleFrequency = 'weekly' | 'fortnightly' | 'monthly';
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/**
 * Ordered as the day runs, so a day card reads top to bottom.
 *
 * Meal type is not decoration: two housemates are only eating *together* if
 * they picked the same recipe on the same day **at the same sitting**. Without
 * it, someone's porridge and someone else's curry on Tuesday look like a clash
 * the house should resolve, and joining a meal could sit you down to breakfast
 * you thought was dinner.
 */
export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];

export const MEAL_STATUSES: MealStatus[] = ['planned', 'cooked', 'skipped', 'swapped'];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

export const MEAL_TYPE_ICONS: Record<MealType, string> = {
  breakfast: 'bakery_dining',
  lunch: 'lunch_dining',
  dinner: 'ramen_dining',
};

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
  /**
   * How housemates pay this person. Separate fields so an incomplete entry is
   * obvious when typed rather than when money moves. The app never contacts a
   * bank — these are displayed and copied, nothing else.
   */
  payment: {
    bankName: string | null;
    sortCode: string | null;
    accountNumber: string | null;
    link: string | null;
    /** Anything that does not fit the fields above. */
    note: string | null;
  };
  isAdmin: boolean;
  /**
   * A seeded placeholder housemate. They have no auth account and cannot sign
   * in; the dev tools can render the app as them to see the other side of a
   * split. Real housemates are never impersonable.
   */
  isDemo: boolean;
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
  dietaryTags: string[];
  instructions: string[];
  proTip: string | null;
  ingredients: RecipeIngredient[];
}

export interface MealParticipant {
  userId: string;
  /** Opted out *before* the order: the ingredients were never bought. */
  optedOut?: boolean;
  /**
   * Dropped out *after* the order. They stay on the meal and keep the cost —
   * the food is bought and it is theirs. Removing them would quietly move
   * their share onto everyone else.
   */
  bailed?: boolean;
  /** Extra mouths they are bringing. Scales the recipe and the shop. */
  guests?: number;
  /** True: the host pays for their guests. False: the table splits them. */
  guestsCovered?: boolean;
}

export interface PlannedMeal {
  id: string;
  planId: string;
  recipeId: string;
  recipeTitle: string;
  day: Weekday;
  mealType: MealType;
  isShared: boolean;
  /**
    * Who put the meal on the plan. They decide how many it feeds; the cook can
    * change hands during the week without handing over that decision.
    */
  createdBy: string | null;
  /** Who is down to cook it. Null means nobody has volunteered. */
  cookedByUserId: string | null;
  /**
   * Housemate asked to take the cooking who has not answered yet. Until they
   * accept, `cookedByUserId` is still the person doing it — nobody is put on
   * the hook for a meal without agreeing to it.
   */
  cookOfferTo: string | null;
  /**
   * Mouths this meal is cooked for, guests included. Null means open to
   * anyone — the default. A number blocks new joins once it is reached, and
   * never removes anybody already in.
   */
  maxDiners: number | null;
  status: MealStatus;
  participants: MealParticipant[];
}

/**
 * A sitting where the house is buying two separate sets of ingredients.
 *
 * NOT a conflict, and deliberately renamed from one. Housemates are allowed to
 * eat different things; the opportunity is that they can cook different things
 * *from the same shopping*. Carries suggestions or it is not raised at all — a
 * warning with no alternative is just a complaint about what somebody fancied.
 */
export interface PlanOverlap {
  day: Weekday;
  /** Which sitting — breakfast and dinner are not in competition. */
  mealType: MealType;
  userIds: string[];
  message: string;
  /** Positive pence: roughly what buying twice costs. An estimate, shown as one. */
  missedSaving: Pence;
  /** Recipes that would draw on what the sitting already buys. */
  suggestions: { recipeId: string; title: string; shares: string[] }[];
}

export interface WeeklyPlan {
  id: string;
  houseId: string;
  weekStartDate: string;
  weekNumber: number;
  status: PlanStatus;
  cutoffAt: string;
  meals: PlannedMeal[];
  /** Shared-shopping suggestions. Never a blocker. */
  overlaps: PlanOverlap[];
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
  /** Map of recipe id to recipe, for accessing metadata like dietaryTags. */
  recipes: Map<string, Recipe>;
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
  /**
   * One pack was assumed because the recipe counts items and Tesco sells the
   * thing by weight. Priced and split like any other line, but flagged — the
   * collector is the only one who can say whether one bunch is enough.
   */
  quantityAssumed: boolean;
  /** Added by hand rather than derived from a recipe. Survives a rebuild. */
  isManual: boolean;
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
  /**
   * False until the collector posts the week. Before that this is a live
   * preview that moves as the basket moves; after it, the agreed figure that
   * "I've Paid" and the ledger both point at.
   */
  isPosted: boolean;
  lines: SplitLine[];
}

/** A purchase made outside the weekly shop, entered by hand. */
export interface Expense {
  id: string;
  houseId: string;
  paidByUserId: string;
  description: string;
  amount: Pence;
  spentOn: string;
  note: string;
  shares: { userId: string; amount: Pence; settled: boolean }[];
}

/** Cooked too much. A message board, not inventory — it carries no cost. */
export interface Leftover {
  id: string;
  houseId: string;
  createdBy: string;
  description: string;
  portions: number;
  madeOn: string;
  eatBy: string;
  /** Negative once it is past its date. */
  daysLeft: number;
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
  /**
   * Where the entry came from. A weekly split is derived from the basket and
   * recomputed; a one-off purchase was typed by a person and never recomputed.
   * The Balances page says which, because "you owe Maya £14" means something
   * different when it is a toaster.
   */
  source: 'split' | 'expense';
}

/** A non-food item the house always needs, re-added to the basket when due. */
export interface HouseStaple {
  id: string;
  ingredientId: string;
  name: string;
  frequency: StapleFrequency;
  lastAddedOn: string | null;
  /** True when the frequency has elapsed, so the next basket build includes it. */
  due: boolean;
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
