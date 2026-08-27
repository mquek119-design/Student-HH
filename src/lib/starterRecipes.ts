/**
 * Starter recipes seeded into new houses.
 * Popular, simple student meals — no prices, just ingredients and instructions.
 * The optimiser prices them against real Tesco data when needed.
 */

import type { IngredientCategory } from './types';

export interface StarterRecipe {
  title: string;
  cookTimeMins: number;
  servings: number;
  tags: string[];
  instructions: string[];
  ingredients: {
    name: string;
    quantity: number;
    unit: string;
    category: IngredientCategory;
  }[];
}

export const STARTER_RECIPES: StarterRecipe[] = [
  {
    title: 'Spaghetti Bolognese',
    cookTimeMins: 45,
    servings: 4,
    tags: ['Western', 'Pasta', 'Beef'],
    instructions: [
      'Brown the mince in a large pan.',
      'Add chopped onion and garlic, cook until soft.',
      'Stir in chopped tomatoes and simmer for 20 minutes.',
      'Serve over spaghetti.',
    ],
    ingredients: [
      { name: 'Minced beef', quantity: 500, unit: 'g', category: 'fresh' },
      { name: 'Onion', quantity: 1, unit: 'each', category: 'fresh' },
      { name: 'Garlic', quantity: 2, unit: 'each', category: 'fresh' },
      { name: 'Chopped tomatoes', quantity: 800, unit: 'g', category: 'cupboard' },
      { name: 'Spaghetti', quantity: 400, unit: 'g', category: 'cupboard' },
    ],
  },
  {
    title: 'Chicken Tikka Masala',
    cookTimeMins: 40,
    servings: 5,
    tags: ['Asian', 'Curry', 'Spicy', 'Chicken'],
    instructions: [
      'Cut chicken into chunks and fry until golden.',
      'Add tikka paste and cook for 2 minutes.',
      'Pour in coconut milk and simmer for 20 minutes.',
      'Serve with rice.',
    ],
    ingredients: [
      { name: 'Chicken breast', quantity: 750, unit: 'g', category: 'fresh' },
      { name: 'Tikka Masala paste', quantity: 180, unit: 'g', category: 'cupboard' },
      { name: 'Coconut milk', quantity: 400, unit: 'ml', category: 'cupboard' },
      { name: 'Rice', quantity: 375, unit: 'g', category: 'cupboard' },
    ],
  },
  {
    title: 'Beef Stir Fry',
    cookTimeMins: 20,
    servings: 2,
    tags: ['Asian', 'Noodles', 'Beef', 'Quick'],
    instructions: [
      'Heat oil in a wok or large pan.',
      'Sear the beef strips until cooked.',
      'Add vegetables and stir fry for 3 minutes.',
      'Add soy sauce and serve over noodles.',
    ],
    ingredients: [
      { name: 'Beef stir fry strips', quantity: 300, unit: 'g', category: 'fresh' },
      { name: 'Soy sauce', quantity: 50, unit: 'ml', category: 'cupboard' },
      { name: 'Broccoli florets', quantity: 200, unit: 'g', category: 'fresh' },
      { name: 'Egg noodles', quantity: 200, unit: 'g', category: 'cupboard' },
    ],
  },
  {
    title: 'Mac and Cheese',
    cookTimeMins: 30,
    servings: 4,
    tags: ['Western', 'Pasta', 'Cheese', 'Comfort'],
    instructions: [
      'Boil the macaroni according to the packet.',
      'Make a roux with butter and flour.',
      'Whisk in milk, add grated cheese.',
      'Mix with pasta and bake at 180°C for 15 minutes.',
    ],
    ingredients: [
      { name: 'Macaroni', quantity: 400, unit: 'g', category: 'cupboard' },
      { name: 'Butter', quantity: 50, unit: 'g', category: 'fresh' },
      { name: 'Flour', quantity: 50, unit: 'g', category: 'cupboard' },
      { name: 'Milk', quantity: 500, unit: 'ml', category: 'fresh' },
      { name: 'Cheddar cheese', quantity: 200, unit: 'g', category: 'fresh' },
    ],
  },
  {
    title: 'Thai Green Curry',
    cookTimeMins: 35,
    servings: 4,
    tags: ['Asian', 'Thai', 'Curry', 'Chicken'],
    instructions: [
      'Fry curry paste in coconut milk for 2 minutes.',
      'Add chicken pieces and simmer for 20 minutes.',
      'Add vegetables and cook for 5 more minutes.',
      'Serve with rice.',
    ],
    ingredients: [
      { name: 'Chicken breast', quantity: 600, unit: 'g', category: 'fresh' },
      { name: 'Thai green curry paste', quantity: 120, unit: 'g', category: 'cupboard' },
      { name: 'Coconut milk', quantity: 400, unit: 'ml', category: 'cupboard' },
      { name: 'Rice', quantity: 300, unit: 'g', category: 'cupboard' },
    ],
  },
];
