/**
 * The demonstration week.
 *
 * Data, not code — it lives here rather than in `seedActions.ts` because that
 * file is `'use server'` and may only export async functions.
 *
 * This is openly fake and only ever reaches a house whose owner pressed "Reset
 * demo data". It still obeys the rule in CLAUDE.md: **it invents no money**.
 * There are no prices, no savings figures and no basket lines here. Recipes,
 * meals and pantry stock are facts about a household; a price is a claim about
 * Tesco, and the only honest source for that is Tesco.
 *
 * The week is shaped to exercise the product rather than to look busy:
 *
 *   Mon, Tue, Wed  — nobody eats together. Separate meals, separate baskets'
 *                    worth of ingredients. Wednesday's stir fry and green curry
 *                    share nothing at all, which is what fires the conflict
 *                    warning on the plan grid.
 *   Thu, Fri       — one shared meal each. The ordinary case.
 *   Sat, Sun       — two shared meals each, at different sittings, so the grid
 *                    has to show that a shared breakfast and a shared dinner
 *                    are two separate things and not one clash.
 *
 * Ingredients recur across recipes deliberately — chicken breast in four,
 * eggs in three, milk in three. Without that repetition the overlap optimiser
 * has nothing to pool and the entire premise of the app goes undemonstrated.
 */

import type { IngredientCategory, MealType, StapleFrequency, Weekday } from './types';

/** Four demo profiles; five people in the house counting whoever seeds it. */
export const DEMO_HOUSEMATES = ['Alex', 'Maya', 'Sam', 'Priya'];

interface DemoIngredient {
  name: string;
  quantity: number;
  unit: string;
  category: IngredientCategory;
}

interface DemoRecipe {
  title: string;
  cookTimeMins: number;
  difficulty: 'easy' | 'medium' | 'hard';
  servings: number;
  tags: string[];
  instructions: string[];
  ingredients: DemoIngredient[];
}

export const DEMO_RECIPES: DemoRecipe[] = [
  // ---------------------------------------------------------------- breakfast
  {
    title: 'Full English Breakfast',
    cookTimeMins: 30,
    difficulty: 'easy',
    servings: 5,
    tags: ['Breakfast', 'British'],
    instructions: [
      'Grill the sausages and bacon.',
      'Fry the mushrooms, warm the beans.',
      'Fry the eggs last and serve everything at once.',
    ],
    ingredients: [
      { name: 'Pork sausages', quantity: 10, unit: 'each', category: 'fresh' },
      { name: 'Bacon rashers', quantity: 10, unit: 'each', category: 'fresh' },
      { name: 'Eggs', quantity: 5, unit: 'each', category: 'fresh' },
      { name: 'Baked beans', quantity: 400, unit: 'g', category: 'cupboard' },
      { name: 'Mushrooms', quantity: 250, unit: 'g', category: 'fresh' },
    ],
  },
  {
    title: 'Scrambled Eggs on Toast',
    cookTimeMins: 10,
    difficulty: 'easy',
    servings: 2,
    tags: ['Breakfast', 'Quick'],
    instructions: [
      'Beat the eggs with the milk.',
      'Scramble slowly in butter.',
      'Toast the bread and pile it on.',
    ],
    ingredients: [
      { name: 'Eggs', quantity: 4, unit: 'each', category: 'fresh' },
      { name: 'Milk', quantity: 50, unit: 'ml', category: 'fresh' },
      { name: 'Butter', quantity: 20, unit: 'g', category: 'fresh' },
      { name: 'Sliced bread', quantity: 4, unit: 'each', category: 'cupboard' },
    ],
  },
  {
    title: 'Overnight Oats',
    cookTimeMins: 5,
    difficulty: 'easy',
    servings: 2,
    tags: ['Breakfast', 'No cook'],
    instructions: [
      'Stir the oats into the milk.',
      'Leave in the fridge overnight.',
      'Top with banana and honey in the morning.',
    ],
    ingredients: [
      { name: 'Porridge oats', quantity: 120, unit: 'g', category: 'cupboard' },
      { name: 'Milk', quantity: 300, unit: 'ml', category: 'fresh' },
      { name: 'Banana', quantity: 2, unit: 'each', category: 'fresh' },
      { name: 'Honey', quantity: 30, unit: 'g', category: 'cupboard' },
    ],
  },

  // -------------------------------------------------------------------- lunch
  {
    title: 'Tuna Pasta Salad',
    cookTimeMins: 20,
    difficulty: 'easy',
    servings: 3,
    tags: ['Lunch', 'Pasta'],
    instructions: [
      'Boil the pasta and cool it under the tap.',
      'Fold through the tuna, sweetcorn and mayo.',
      'Season heavily; it needs it.',
    ],
    ingredients: [
      { name: 'Penne pasta', quantity: 300, unit: 'g', category: 'cupboard' },
      { name: 'Tuna chunks', quantity: 320, unit: 'g', category: 'cupboard' },
      { name: 'Sweetcorn', quantity: 200, unit: 'g', category: 'cupboard' },
      { name: 'Mayonnaise', quantity: 100, unit: 'ml', category: 'cupboard' },
    ],
  },
  {
    title: 'Chicken Wrap',
    cookTimeMins: 15,
    difficulty: 'easy',
    servings: 2,
    tags: ['Lunch', 'Chicken'],
    instructions: [
      'Fry the chicken until cooked through.',
      'Warm the wraps.',
      'Fill with chicken, lettuce and mayo.',
    ],
    ingredients: [
      { name: 'Chicken breast', quantity: 300, unit: 'g', category: 'fresh' },
      { name: 'Tortilla wraps', quantity: 4, unit: 'each', category: 'cupboard' },
      { name: 'Lettuce', quantity: 1, unit: 'each', category: 'fresh' },
      { name: 'Mayonnaise', quantity: 50, unit: 'ml', category: 'cupboard' },
    ],
  },

  // ------------------------------------------------------------------- dinner
  {
    title: 'Chicken Tikka Masala',
    cookTimeMins: 40,
    difficulty: 'medium',
    servings: 5,
    tags: ['Asian', 'Curry', 'Spicy'],
    instructions: ['Brown the chicken.', 'Add paste and coconut milk, simmer.', 'Serve with rice.'],
    ingredients: [
      { name: 'Chicken breast', quantity: 750, unit: 'g', category: 'fresh' },
      { name: 'Tikka Masala paste', quantity: 180, unit: 'g', category: 'cupboard' },
      { name: 'Coconut milk', quantity: 400, unit: 'ml', category: 'cupboard' },
      { name: 'Rice', quantity: 375, unit: 'g', category: 'cupboard' },
    ],
  },
  {
    title: 'Thai Green Curry',
    cookTimeMins: 35,
    difficulty: 'medium',
    servings: 4,
    tags: ['Asian', 'Thai', 'Curry'],
    instructions: ['Fry the paste.', 'Add coconut milk and chicken, simmer.', 'Serve with rice.'],
    ingredients: [
      { name: 'Chicken breast', quantity: 600, unit: 'g', category: 'fresh' },
      { name: 'Thai green curry paste', quantity: 120, unit: 'g', category: 'cupboard' },
      { name: 'Coconut milk', quantity: 400, unit: 'ml', category: 'cupboard' },
      { name: 'Rice', quantity: 300, unit: 'g', category: 'cupboard' },
    ],
  },
  {
    title: 'Beef stir fry noodles',
    cookTimeMins: 20,
    difficulty: 'easy',
    servings: 2,
    tags: ['Asian', 'Noodles', 'Beef'],
    instructions: ['Sear the beef hard.', 'Add veg and sauce.', 'Toss through the noodles.'],
    ingredients: [
      { name: 'Beef stir fry strips', quantity: 300, unit: 'g', category: 'fresh' },
      { name: 'Soy sauce', quantity: 50, unit: 'ml', category: 'cupboard' },
      { name: 'Garlic', quantity: 1, unit: 'each', category: 'fresh' },
      { name: 'Broccoli florets', quantity: 200, unit: 'g', category: 'fresh' },
      { name: 'Egg noodles', quantity: 200, unit: 'g', category: 'cupboard' },
    ],
  },
  {
    title: 'Chicken Miso Ramen',
    cookTimeMins: 30,
    difficulty: 'medium',
    servings: 2,
    tags: ['Asian', 'Japanese', 'Ramen'],
    instructions: ['Heat the stock with miso.', 'Cook the noodles.', 'Top with egg and spring onion.'],
    ingredients: [
      { name: 'Ramen noodles', quantity: 200, unit: 'g', category: 'cupboard' },
      { name: 'Chicken stock cubes', quantity: 2, unit: 'each', category: 'cupboard' },
      { name: 'Miso paste', quantity: 60, unit: 'g', category: 'cupboard' },
      { name: 'Eggs', quantity: 2, unit: 'each', category: 'fresh' },
      { name: 'Spring onions', quantity: 4, unit: 'each', category: 'fresh' },
    ],
  },
  {
    title: 'Sushi Roll',
    cookTimeMins: 50,
    difficulty: 'hard',
    servings: 2,
    tags: ['Asian', 'Japanese', 'Sushi'],
    instructions: ['Cook and season the rice.', 'Roll with the fillings.', 'Slice with a wet knife.'],
    ingredients: [
      { name: 'Sushi rice', quantity: 250, unit: 'g', category: 'cupboard' },
      { name: 'Nori sheets', quantity: 5, unit: 'each', category: 'cupboard' },
      { name: 'Cucumber', quantity: 1, unit: 'each', category: 'fresh' },
      { name: 'Avocado', quantity: 1, unit: 'each', category: 'fresh' },
    ],
  },
  {
    title: 'Spaghetti Bolognese',
    cookTimeMins: 45,
    difficulty: 'easy',
    servings: 4,
    tags: ['Western', 'Pasta', 'Beef'],
    instructions: ['Brown the mince.', 'Add tomatoes and simmer.', 'Serve over spaghetti.'],
    ingredients: [
      { name: 'Minced beef', quantity: 500, unit: 'g', category: 'fresh' },
      { name: 'Onion', quantity: 1, unit: 'each', category: 'fresh' },
      { name: 'Garlic', quantity: 1, unit: 'each', category: 'fresh' },
      { name: 'Chopped tomatoes', quantity: 800, unit: 'g', category: 'cupboard' },
      { name: 'Spaghetti', quantity: 400, unit: 'g', category: 'cupboard' },
    ],
  },
  {
    title: 'Classic Beef Burger',
    cookTimeMins: 15,
    difficulty: 'easy',
    servings: 5,
    tags: ['Western', 'Burger', 'Beef'],
    instructions: ['Griddle the patties.', 'Melt cheese on top.', 'Build in a toasted bun.'],
    ingredients: [
      { name: 'Beef burgers', quantity: 5, unit: 'each', category: 'fresh' },
      { name: 'Burger buns', quantity: 5, unit: 'each', category: 'fresh' },
      { name: 'Cheddar cheese', quantity: 150, unit: 'g', category: 'fresh' },
      { name: 'Lettuce', quantity: 1, unit: 'each', category: 'fresh' },
    ],
  },
  {
    title: 'Mac and Cheese',
    cookTimeMins: 30,
    difficulty: 'easy',
    servings: 4,
    tags: ['Western', 'Pasta', 'Cheese'],
    instructions: ['Make a roux.', 'Whisk in milk and cheese.', 'Fold through the macaroni and bake.'],
    ingredients: [
      { name: 'Macaroni', quantity: 400, unit: 'g', category: 'cupboard' },
      { name: 'Butter', quantity: 50, unit: 'g', category: 'fresh' },
      { name: 'Flour', quantity: 50, unit: 'g', category: 'cupboard' },
      { name: 'Milk', quantity: 500, unit: 'ml', category: 'fresh' },
      { name: 'Cheddar cheese', quantity: 200, unit: 'g', category: 'fresh' },
    ],
  },
  {
    title: 'Chicken Caesar Salad',
    cookTimeMins: 25,
    difficulty: 'easy',
    servings: 2,
    tags: ['Western', 'Salad', 'Chicken'],
    instructions: ['Grill the chicken.', 'Toss lettuce with dressing.', 'Add croutons and slice on top.'],
    ingredients: [
      { name: 'Chicken breast', quantity: 300, unit: 'g', category: 'fresh' },
      { name: 'Lettuce', quantity: 1, unit: 'each', category: 'fresh' },
      { name: 'Caesar dressing', quantity: 100, unit: 'ml', category: 'cupboard' },
      { name: 'Croutons', quantity: 100, unit: 'g', category: 'cupboard' },
    ],
  },
  {
    title: 'Pizza Margherita',
    cookTimeMins: 25,
    difficulty: 'medium',
    servings: 2,
    tags: ['Western', 'Pizza', 'Cheese'],
    instructions: ['Stretch the dough.', 'Sauce and cheese it.', 'Bake as hot as the oven goes.'],
    ingredients: [
      { name: 'Pizza dough', quantity: 1, unit: 'each', category: 'fresh' },
      { name: 'Passata', quantity: 150, unit: 'g', category: 'cupboard' },
      { name: 'Mozzarella cheese', quantity: 150, unit: 'g', category: 'fresh' },
      { name: 'Fresh basil', quantity: 1, unit: 'each', category: 'fresh' },
    ],
  },
];

interface DemoMeal {
  day: Weekday;
  mealType: MealType;
  recipe: string;
  /** Names, resolved to ids by the seeder. `me` is whoever pressed the button. */
  diners: string[];
  /** Optional +1, so the guest weighting is visible without setting it up. */
  guests?: { who: string; count: number; covered: boolean };
}

export const DEMO_SCHEDULE: DemoMeal[] = [
  // --- Mon: three people, three different dinners, nothing in common. -------
  { day: 'mon', mealType: 'dinner', recipe: 'Sushi Roll', diners: ['me'] },
  { day: 'mon', mealType: 'dinner', recipe: 'Classic Beef Burger', diners: ['Alex'] },
  { day: 'mon', mealType: 'dinner', recipe: 'Mac and Cheese', diners: ['Maya'] },

  // --- Tue: a solo breakfast and two solo dinners. The breakfast exists to
  //     prove a different sitting is not a clash — it must not warn. ---------
  { day: 'tue', mealType: 'breakfast', recipe: 'Scrambled Eggs on Toast', diners: ['me'] },
  { day: 'tue', mealType: 'dinner', recipe: 'Pizza Margherita', diners: ['Sam'] },
  { day: 'tue', mealType: 'dinner', recipe: 'Chicken Miso Ramen', diners: ['Priya'] },

  // --- Wed: three solo dinners, and the stir fry vs green curry pair shares
  //     no ingredient at all — this is the day the conflict warning fires. ---
  { day: 'wed', mealType: 'dinner', recipe: 'Beef stir fry noodles', diners: ['me'] },
  { day: 'wed', mealType: 'dinner', recipe: 'Thai Green Curry', diners: ['Maya'] },
  { day: 'wed', mealType: 'dinner', recipe: 'Chicken Caesar Salad', diners: ['Alex'] },

  // --- Thu and Fri: one shared meal each. -----------------------------------
  {
    day: 'thu',
    mealType: 'dinner',
    recipe: 'Spaghetti Bolognese',
    diners: ['me', 'Alex', 'Maya', 'Sam'],
  },
  {
    day: 'fri',
    mealType: 'dinner',
    recipe: 'Chicken Tikka Masala',
    diners: ['me', 'Alex', 'Maya', 'Sam', 'Priya'],
  },

  // --- Sat and Sun: two shared meals each, at different sittings. -----------
  {
    day: 'sat',
    mealType: 'lunch',
    recipe: 'Tuna Pasta Salad',
    diners: ['me', 'Alex', 'Priya'],
    // Alex has someone over and is covering them, so Saturday lunch is cooked
    // for four and Alex carries two portions of it.
    guests: { who: 'Alex', count: 1, covered: true },
  },
  {
    day: 'sat',
    mealType: 'dinner',
    recipe: 'Classic Beef Burger',
    diners: ['me', 'Alex', 'Maya', 'Sam', 'Priya'],
  },
  {
    day: 'sun',
    mealType: 'breakfast',
    recipe: 'Full English Breakfast',
    diners: ['me', 'Alex', 'Maya', 'Sam', 'Priya'],
  },
  {
    day: 'sun',
    mealType: 'dinner',
    recipe: 'Thai Green Curry',
    diners: ['me', 'Maya', 'Sam', 'Priya'],
  },
];

/**
 * Shared pantry stock. Named ingredients only — the seeder skips anything the
 * recipes never introduced, because a pantry item for food nobody cooks cannot
 * be subtracted from anything.
 */
export const DEMO_PANTRY: { name: string; quantity: number; unit: string; lowStock?: boolean }[] = [
  { name: 'Rice', quantity: 500, unit: 'g' },
  { name: 'Butter', quantity: 250, unit: 'g' },
  { name: 'Milk', quantity: 1000, unit: 'ml' },
  { name: 'Soy sauce', quantity: 150, unit: 'ml' },
  { name: 'Mayonnaise', quantity: 180, unit: 'g' },
  { name: 'Flour', quantity: 200, unit: 'g', lowStock: true },
];

/**
 * The standing staples list. Non-food, so no recipe will ever ask for it, and
 * split equally because nobody's curry is responsible for the bin bags.
 */
export const DEMO_STAPLES: { name: string; frequency: StapleFrequency }[] = [
  { name: 'Toilet roll', frequency: 'weekly' },
  { name: 'Washing up liquid', frequency: 'fortnightly' },
  { name: 'Bin bags', frequency: 'monthly' },
];

/**
 * One dish on the leftovers board, dated so it is always about to go off —
 * otherwise the Feed nudge that depends on it would never be seen.
 */
export const DEMO_LEFTOVERS: { description: string; portions: number; daysLeft: number }[] = [
  { description: 'Chilli', portions: 2, daysLeft: 1 },
];

/**
 * One purchase from outside the weekly shop, split equally. Small on purpose:
 * the point is to show it landing on the balances next to the Tesco split, not
 * to dominate them.
 */
export const DEMO_EXPENSES: { description: string; amount: number; note: string }[] = [
  { description: 'Replacement kettle', amount: 1899, note: "Receipt's in the kitchen drawer" },
];
