'use server';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/queries';

export async function seedDemoData() {
  const me = await getCurrentUser();
  if (!me.houseId) return { status: 'error', message: 'Join a house first.' };

  const supabase = createClient();

  // 2. Seed 5 Asian and 5 Western Recipes
  const recipesToSeed = [
    // Asian Recipes
    {
      title: 'Chicken Tikka Masala',
      cookTimeMins: 40,
      difficulty: 'medium' as const,
      servings: 4,
      costPerPortion: 250,
      tags: ['Asian', 'Curry', 'Spicy'],
      ingredients: [
        { name: 'Chicken breast', quantity: 600, unit: 'g', category: 'fresh' as const },
        { name: 'Tikka Masala paste', quantity: 150, unit: 'g', category: 'cupboard' as const },
        { name: 'Coconut milk', quantity: 400, unit: 'ml', category: 'cupboard' as const },
        { name: 'Rice', quantity: 300, unit: 'g', category: 'cupboard' as const },
      ],
    },
    {
      title: 'Beef stir fry noodles',
      cookTimeMins: 20,
      difficulty: 'easy' as const,
      servings: 2,
      costPerPortion: 350,
      tags: ['Asian', 'Noodles', 'Beef'],
      ingredients: [
        { name: 'Beef strips', quantity: 300, unit: 'g', category: 'fresh' as const },
        { name: 'Soy sauce', quantity: 50, unit: 'ml', category: 'cupboard' as const },
        { name: 'Garlic cloves', quantity: 3, unit: 'each', category: 'fresh' as const },
        { name: 'Broccoli florets', quantity: 200, unit: 'g', category: 'fresh' as const },
        { name: 'Noodles', quantity: 200, unit: 'g', category: 'cupboard' as const },
      ],
    },
    {
      title: 'Thai Green Curry',
      cookTimeMins: 35,
      difficulty: 'medium' as const,
      servings: 4,
      costPerPortion: 300,
      tags: ['Asian', 'Thai', 'Curry'],
      ingredients: [
        { name: 'Chicken breast', quantity: 600, unit: 'g', category: 'fresh' as const },
        { name: 'Thai green curry paste', quantity: 120, unit: 'g', category: 'cupboard' as const },
        { name: 'Coconut milk', quantity: 400, unit: 'ml', category: 'cupboard' as const },
        { name: 'Jasmine rice', quantity: 300, unit: 'g', category: 'cupboard' as const },
      ],
    },
    {
      title: 'Sushi Roll',
      cookTimeMins: 50,
      difficulty: 'hard' as const,
      servings: 2,
      costPerPortion: 400,
      tags: ['Asian', 'Japanese', 'Sushi'],
      ingredients: [
        { name: 'Sushi rice', quantity: 250, unit: 'g', category: 'cupboard' as const },
        { name: 'Nori sheets', quantity: 5, unit: 'each', category: 'cupboard' as const },
        { name: 'Cucumber', quantity: 1, unit: 'each', category: 'fresh' as const },
        { name: 'Avocado', quantity: 1, unit: 'each', category: 'fresh' as const },
      ],
    },
    {
      title: 'Chicken Miso Ramen',
      cookTimeMins: 30,
      difficulty: 'medium' as const,
      servings: 2,
      costPerPortion: 280,
      tags: ['Asian', 'Japanese', 'Ramen'],
      ingredients: [
        { name: 'Ramen noodles', quantity: 200, unit: 'g', category: 'cupboard' as const },
        { name: 'Chicken stock', quantity: 1000, unit: 'ml', category: 'cupboard' as const },
        { name: 'Miso paste', quantity: 60, unit: 'g', category: 'cupboard' as const },
        { name: 'Eggs', quantity: 2, unit: 'each', category: 'fresh' as const },
        { name: 'Spring onions', quantity: 4, unit: 'each', category: 'fresh' as const },
      ],
    },
    // Western Recipes
    {
      title: 'Spaghetti Bolognese',
      cookTimeMins: 45,
      difficulty: 'easy' as const,
      servings: 4,
      costPerPortion: 200,
      tags: ['Western', 'Pasta', 'Beef'],
      ingredients: [
        { name: 'Minced beef', quantity: 500, unit: 'g', category: 'fresh' as const },
        { name: 'Onion', quantity: 1, unit: 'each', category: 'fresh' as const },
        { name: 'Garlic cloves', quantity: 2, unit: 'each', category: 'fresh' as const },
        { name: 'Chopped tomatoes', quantity: 800, unit: 'g', category: 'cupboard' as const },
        { name: 'Spaghetti', quantity: 400, unit: 'g', category: 'cupboard' as const },
      ],
    },
    {
      title: 'Chicken Caesar Salad',
      cookTimeMins: 25,
      difficulty: 'easy' as const,
      servings: 2,
      costPerPortion: 260,
      tags: ['Western', 'Salad', 'Chicken'],
      ingredients: [
        { name: 'Chicken breast', quantity: 300, unit: 'g', category: 'fresh' as const },
        { name: 'Cos lettuce', quantity: 1, unit: 'each', category: 'fresh' as const },
        { name: 'Caesar dressing', quantity: 100, unit: 'ml', category: 'cupboard' as const },
        { name: 'Croutons', quantity: 100, unit: 'g', category: 'cupboard' as const },
      ],
    },
    {
      title: 'Classic Beef Burger',
      cookTimeMins: 15,
      difficulty: 'easy' as const,
      servings: 2,
      costPerPortion: 320,
      tags: ['Western', 'Burger', 'Beef'],
      ingredients: [
        { name: 'Beef patties', quantity: 2, unit: 'each', category: 'fresh' as const },
        { name: 'Burger buns', quantity: 2, unit: 'each', category: 'fresh' as const },
        { name: 'Cheddar cheese', quantity: 100, unit: 'g', category: 'fresh' as const },
        { name: 'Lettuce', quantity: 1, unit: 'each', category: 'fresh' as const },
      ],
    },
    {
      title: 'Mac and Cheese',
      cookTimeMins: 30,
      difficulty: 'easy' as const,
      servings: 4,
      costPerPortion: 180,
      tags: ['Western', 'Pasta', 'Cheese'],
      ingredients: [
        { name: 'Macaroni', quantity: 400, unit: 'g', category: 'cupboard' as const },
        { name: 'Butter', quantity: 50, unit: 'g', category: 'fresh' as const },
        { name: 'Flour', quantity: 50, unit: 'g', category: 'cupboard' as const },
        { name: 'Milk', quantity: 500, unit: 'ml', category: 'fresh' as const },
        { name: 'Cheddar cheese', quantity: 200, unit: 'g', category: 'fresh' as const },
      ],
    },
    {
      title: 'Pizza Margherita',
      cookTimeMins: 25,
      difficulty: 'medium' as const,
      servings: 2,
      costPerPortion: 220,
      tags: ['Western', 'Pizza', 'Cheese'],
      ingredients: [
        { name: 'Pizza dough', quantity: 1, unit: 'each', category: 'fresh' as const },
        { name: 'Tomato sauce', quantity: 150, unit: 'ml', category: 'cupboard' as const },
        { name: 'Mozzarella cheese', quantity: 150, unit: 'g', category: 'fresh' as const },
        { name: 'Fresh basil', quantity: 1, unit: 'each', category: 'fresh' as const },
      ],
    },
  ];

  for (const r of recipesToSeed) {
    const { data: existingRec } = await supabase
      .from('recipes')
      .select('id')
      .eq('house_id', me.houseId)
      .eq('title', r.title)
      .maybeSingle();

    if (existingRec) continue;

    const ingredientIds: string[] = [];
    for (const ing of r.ingredients) {
      const { data: existingIng } = await supabase
        .from('ingredients')
        .select('id')
        .ilike('name', ing.name)
        .maybeSingle();

      let ingId = existingIng?.id;
      if (!ingId) {
        const { data: newIng } = await supabase
          .from('ingredients')
          .insert({ name: ing.name, default_unit: ing.unit, category: ing.category })
          .select('id')
          .single();
        ingId = newIng?.id;
      }
      if (ingId) ingredientIds.push(ingId);
    }

    const { data: newRecipe } = await supabase
      .from('recipes')
      .insert({
        house_id: me.houseId,
        created_by: me.id,
        title: r.title,
        cook_time_mins: r.cookTimeMins,
        difficulty: r.difficulty,
        servings: r.servings,
        cost_per_portion: r.costPerPortion,
        tags: r.tags,
        instructions: ['Prep ingredients.', 'Cook until delicious.', 'Serve warm.'],
      })
      .select('id')
      .single();

    if (newRecipe) {
      const links = r.ingredients.map((ing, idx) => ({
        recipe_id: newRecipe.id,
        ingredient_id: ingredientIds[idx],
        quantity: ing.quantity,
        unit: ing.unit,
      }));
      await supabase.from('recipe_ingredients').insert(links);
    }
  }

  return { status: 'success', message: 'Demo recipes seeded successfully! To test splits, copy the invite code from House Settings and log in with other email accounts in separate browser sessions.' };
}
