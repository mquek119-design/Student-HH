-- HouseGrocer — development seed
--
-- Optional demo house for kicking the tyres. The app itself ships no fixtures;
-- this file exists purely so you can see populated screens. Safe to re-run.
--
-- PREREQUISITE: seeding needs real auth.users rows, because profiles.id is an
-- FK onto them. Create four users first (Studio → Authentication → Add user,
-- or the admin API), then paste their UUIDs below.

do $$
declare
  -- ↓↓↓ REPLACE THESE with real auth.users UUIDs before running ↓↓↓
  maya_id  uuid := '00000000-0000-0000-0000-000000000001';
  sarah_id uuid := '00000000-0000-0000-0000-000000000002';
  mike_id  uuid := '00000000-0000-0000-0000-000000000003';
  alex_id  uuid := '00000000-0000-0000-0000-000000000004';

  v_house_id uuid;
  v_plan_id  uuid;

  -- Ingredients
  i_penne uuid; i_tomatoes uuid; i_cream_cheese uuid; i_garlic uuid;
  i_basil uuid; i_olive_oil uuid; i_tortillas uuid; i_black_beans uuid;
  i_onion uuid; i_pepper uuid; i_soured_cream uuid; i_lime uuid;
  i_oat_milk uuid; i_noodles uuid; i_soy uuid; i_gravy uuid;

  -- Recipes
  r_pasta uuid; r_tacos uuid; r_roast uuid; r_lasagne uuid; r_stirfry uuid;

  m_mon uuid; m_wed_roast uuid; m_wed_lasagne uuid;
  b_milk uuid; b_pasta uuid; b_soured uuid;
begin
  if not exists (select 1 from auth.users where id = maya_id) then
    raise exception
      'Seed aborted: no auth.users row for %. Create the four demo users and put their UUIDs at the top of this file.',
      maya_id;
  end if;

  -- Idempotency: drop the demo house. Cascades take the plan, meals, basket
  -- and pantry with it.
  delete from houses where name = 'Ellesmere Road';

  insert into houses (name, invite_code, delivery_day, delivery_time, cutoff_day, cutoff_time, shared_staples_enabled)
  values ('Ellesmere Road', 'ELLE-4482', 'mon', '18:00', 'sun', '17:00', true)
  returning id into v_house_id;

  -- Profiles already exist via the on_auth_user_created trigger; top them up.
  update profiles set name = 'Maya',  house_id = v_house_id, room = 'Room 2', accent = 'green',
    dietary_preferences = array['Vegetarian'], is_admin = true,
    payment_details_text = 'Monzo · 04-00-04 · 12345678' where id = maya_id;
  update profiles set name = 'Sarah', house_id = v_house_id, room = 'Room 1', accent = 'orange',
    payment_details_text = 'Starling · 04-00-04 · 12345678' where id = sarah_id;
  update profiles set name = 'Mike',  house_id = v_house_id, room = 'Room 3', accent = 'blue',
    dietary_preferences = array['No pork'] where id = mike_id;
  update profiles set name = 'Alex',  house_id = v_house_id, room = 'Room 4', accent = 'purple'
    where id = alex_id;

  update houses set collector_user_id = sarah_id where id = v_house_id;

  -- Ingredients are global and shared across houses, so upsert rather than clear.
  insert into ingredients (name, default_unit, category) values
    ('Penne pasta', 'g', 'cupboard'), ('Chopped tomatoes', 'tins', 'cupboard'),
    ('Cream cheese', 'g', 'fresh'),   ('Garlic', 'cloves', 'fresh'),
    ('Fresh basil', 'pack', 'fresh'), ('Olive oil', 'ml', 'cupboard'),
    ('Tortillas', 'pack', 'cupboard'),('Black beans', 'tins', 'cupboard'),
    ('Red onion', 'whole', 'fresh'),  ('Bell pepper', 'whole', 'fresh'),
    ('Soured cream', 'ml', 'fresh'),  ('Lime', 'whole', 'fresh'),
    ('Oat milk', 'ml', 'fresh'),      ('Egg noodles', 'nests', 'cupboard'),
    ('Soy sauce', 'ml', 'cupboard'),  ('Gravy granules', 'g', 'cupboard')
  on conflict (lower(name)) do nothing;

  select id into i_penne        from ingredients where lower(name) = 'penne pasta';
  select id into i_tomatoes     from ingredients where lower(name) = 'chopped tomatoes';
  select id into i_cream_cheese from ingredients where lower(name) = 'cream cheese';
  select id into i_garlic       from ingredients where lower(name) = 'garlic';
  select id into i_basil        from ingredients where lower(name) = 'fresh basil';
  select id into i_olive_oil    from ingredients where lower(name) = 'olive oil';
  select id into i_tortillas    from ingredients where lower(name) = 'tortillas';
  select id into i_black_beans  from ingredients where lower(name) = 'black beans';
  select id into i_onion        from ingredients where lower(name) = 'red onion';
  select id into i_pepper       from ingredients where lower(name) = 'bell pepper';
  select id into i_soured_cream from ingredients where lower(name) = 'soured cream';
  select id into i_lime         from ingredients where lower(name) = 'lime';
  select id into i_oat_milk     from ingredients where lower(name) = 'oat milk';
  select id into i_noodles      from ingredients where lower(name) = 'egg noodles';
  select id into i_soy          from ingredients where lower(name) = 'soy sauce';
  select id into i_gravy        from ingredients where lower(name) = 'gravy granules';

  -- Recipes ------------------------------------------------------------------

  insert into recipes (house_id, created_by, title, cook_time_mins, difficulty, servings, cost_per_portion, tags, instructions, pro_tip)
  values (v_house_id, maya_id, 'Creamy Tomato Pasta', 20, 'easy', 4, 180,
    array['Vegetarian', '15-min meals'],
    array[
      'Bring a large pan of salted water to the boil and cook the penne until al dente, about 11 minutes.',
      'While the pasta cooks, soften the garlic in olive oil over a medium heat for 1 minute — do not let it colour.',
      'Add the chopped tomatoes and a pinch of salt. Simmer for 8 minutes until thickened.',
      'Stir through the cream cheese until the sauce turns glossy and pink.',
      'Drain the pasta, reserving a mugful of the water. Toss the pasta through the sauce, loosening with the pasta water.',
      'Finish with torn basil and a generous grating of cheese.'],
    'The starchy pasta water is what makes the sauce cling. Never drain it all away.')
  returning id into r_pasta;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit) values
    (r_pasta, i_penne, 500, 'g'), (r_pasta, i_tomatoes, 2, 'tins'),
    (r_pasta, i_cream_cheese, 180, 'g'), (r_pasta, i_garlic, 3, 'cloves'),
    (r_pasta, i_basil, 1, 'pack'), (r_pasta, i_olive_oil, 2, 'tbsp');

  insert into recipes (house_id, created_by, title, cook_time_mins, difficulty, servings, cost_per_portion, tags, instructions, pro_tip)
  values (v_house_id, alex_id, 'Black Bean Tacos', 25, 'easy', 6, 210,
    array['Vegetarian', 'Crowd pleaser'],
    array[
      'Warm the tortillas in a dry pan, 30 seconds a side, and wrap in a tea towel to keep soft.',
      'Fry the onion and pepper over a high heat until charred at the edges.',
      'Add the drained black beans, cumin and smoked paprika. Cook 5 minutes, crushing some beans against the pan.',
      'Squeeze over half a lime and season hard.',
      'Build the tacos and top with soured cream and coriander.'],
    'Crushing a third of the beans gives the filling body so it does not fall out of the taco.')
  returning id into r_tacos;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit) values
    (r_tacos, i_tortillas, 12, 'pack'), (r_tacos, i_black_beans, 2, 'tins'),
    (r_tacos, i_onion, 2, 'whole'), (r_tacos, i_pepper, 2, 'whole'),
    (r_tacos, i_soured_cream, 300, 'ml'), (r_tacos, i_lime, 2, 'whole');

  insert into recipes (house_id, created_by, title, cook_time_mins, difficulty, servings, cost_per_portion, tags, instructions, pro_tip)
  values (v_house_id, sarah_id, 'Sunday Roast', 120, 'medium', 6, 320,
    array['House Favourite'],
    array[
      'Heat the oven to 200°C fan.',
      'Parboil the potatoes 8 minutes, drain and shake hard in the colander to rough the edges.',
      'Roast the potatoes in hot oil for 50 minutes, turning once.',
      'Roast the chicken for 1 hour 20, resting 20 minutes before carving.',
      'Steam the greens in the last 6 minutes and make the gravy from the roasting juices.'],
    'Shaking the parboiled potatoes is the whole trick. Rough edges catch the fat and go crunchy.')
  returning id into r_roast;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit) values
    (r_roast, i_gravy, 1, 'tub'), (r_roast, i_olive_oil, 3, 'tbsp');

  insert into recipes (house_id, created_by, title, cook_time_mins, difficulty, servings, cost_per_portion, tags, instructions, pro_tip)
  values (v_house_id, maya_id, 'Veggie Lasagne', 75, 'medium', 6, 240,
    array['Vegetarian', 'House Favourite'],
    array[
      'Soften the onion, courgette and pepper in oil for 10 minutes.',
      'Add the chopped tomatoes and simmer 15 minutes until thick.',
      'Layer the sauce, lasagne sheets and white sauce, finishing with white sauce.',
      'Bake at 180°C fan for 40 minutes until browned and bubbling.',
      'Rest 10 minutes before cutting or it will slide apart.'],
    'Resting is not optional. Cut it straight from the oven and you get soup.')
  returning id into r_lasagne;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit) values
    (r_lasagne, i_tomatoes, 2, 'tins'), (r_lasagne, i_pepper, 2, 'whole'),
    (r_lasagne, i_onion, 1, 'whole');

  insert into recipes (house_id, created_by, title, cook_time_mins, difficulty, servings, cost_per_portion, tags, instructions, pro_tip)
  values (v_house_id, alex_id, 'Chicken Stir Fry', 15, 'easy', 2, 190,
    array['15-min meals'],
    array[
      'Get the wok as hot as it will go before anything touches it.',
      'Sear the sliced chicken 4 minutes until golden, then set aside.',
      'Stir fry the vegetables 3 minutes, keeping them moving.',
      'Return the chicken, add the sauce and toss for 1 minute.'],
    'A crowded wok steams instead of frying. Cook in two batches if you need to.')
  returning id into r_stirfry;

  insert into recipe_ingredients (recipe_id, ingredient_id, quantity, unit) values
    (r_stirfry, i_noodles, 2, 'nests'), (r_stirfry, i_soy, 3, 'tbsp');

  -- Weekly plan --------------------------------------------------------------
  -- Anchored to the current week so the countdown reads sensibly whenever you seed.

  insert into weekly_plans (house_id, week_start_date, week_number, status, cutoff_at, shared_savings)
  values (
    v_house_id,
    date_trunc('week', current_date)::date,
    extract(week from current_date)::int,
    'planning',
    (date_trunc('week', current_date) + interval '6 days 17 hours')::timestamptz,
    2450
  )
  returning id into v_plan_id;

  insert into planned_meals (plan_id, recipe_id, day, meal_type, is_shared, cooked_by_user_id)
  values (v_plan_id, r_tacos, 'mon', 'dinner', true, alex_id) returning id into m_mon;
  insert into meal_participants (planned_meal_id, user_id) values
    (m_mon, maya_id), (m_mon, sarah_id), (m_mon, mike_id), (m_mon, alex_id);

  -- Tuesday: two disjoint solo meals. detectConflicts() should flag this.
  insert into planned_meals (plan_id, recipe_id, day, meal_type, is_shared, cooked_by_user_id)
  values (v_plan_id, r_pasta, 'tue', 'dinner', false, maya_id) returning id into m_wed_roast;
  insert into meal_participants (planned_meal_id, user_id) values (m_wed_roast, maya_id);

  insert into planned_meals (plan_id, recipe_id, day, meal_type, is_shared, cooked_by_user_id)
  values (v_plan_id, r_stirfry, 'tue', 'dinner', false, alex_id) returning id into m_wed_lasagne;
  insert into meal_participants (planned_meal_id, user_id) values (m_wed_lasagne, alex_id);

  -- Wednesday: a split night — two shared groups, which is not a conflict.
  insert into planned_meals (plan_id, recipe_id, day, meal_type, is_shared, cooked_by_user_id)
  values (v_plan_id, r_roast, 'wed', 'dinner', true, sarah_id) returning id into m_wed_roast;
  insert into meal_participants (planned_meal_id, user_id) values
    (m_wed_roast, sarah_id), (m_wed_roast, mike_id);

  insert into planned_meals (plan_id, recipe_id, day, meal_type, is_shared, cooked_by_user_id)
  values (v_plan_id, r_lasagne, 'wed', 'dinner', true, maya_id) returning id into m_wed_lasagne;
  insert into meal_participants (planned_meal_id, user_id) values
    (m_wed_lasagne, maya_id), (m_wed_lasagne, alex_id);

  -- Basket -------------------------------------------------------------------
  -- Prices in pence. Totals to £25.60 with the own-brand swaps applied.

  insert into basket_items (plan_id, tesco_product_id, name, subtitle, category, quantity, unit_price, original_unit_price, own_brand_available)
  values (v_plan_id, '254656543', 'Organic Bananas', 'Fairtrade, 5 pack', 'fresh', 1, 140, null, false);

  insert into basket_items (plan_id, tesco_product_id, name, subtitle, category, quantity, unit_price, original_unit_price, own_brand_available)
  values (v_plan_id, '254656544', 'Whole Milk', 'Dairy Crest, 4 pints', 'fresh', 2, 165, null, true)
  returning id into b_milk;
  insert into basket_allocations (basket_item_id, user_id, share) values (b_milk, mike_id, 1);

  insert into basket_items (plan_id, tesco_product_id, name, subtitle, category, quantity, unit_price, original_unit_price, own_brand_available)
  values (v_plan_id, '254656545', 'Soured Cream', 'Yeo Valley, 300ml', 'fresh', 1, 120, null, true)
  returning id into b_soured;

  insert into basket_items (plan_id, tesco_product_id, name, subtitle, category, quantity, unit_price, original_unit_price, own_brand_available)
  values (v_plan_id, '254656546', 'Bell Peppers', 'Mixed, 3 pack', 'fresh', 2, 185, null, false);

  insert into basket_items (plan_id, tesco_product_id, name, subtitle, category, quantity, unit_price, original_unit_price, own_brand_available)
  values (v_plan_id, '254656547', 'Penne Pasta', 'Barilla, 500g', 'cupboard', 4, 120, 180, true)
  returning id into b_pasta;

  insert into basket_items (plan_id, tesco_product_id, name, subtitle, category, quantity, unit_price, original_unit_price, own_brand_available)
  values
    (v_plan_id, '254656548', 'Chopped Tomatoes', 'Own brand, 400g x4', 'cupboard', 2, 145, 220, true),
    (v_plan_id, '254656549', 'Black Beans', 'Own brand, 400g', 'cupboard', 2, 65, null, false),
    (v_plan_id, '254656550', 'Washing Up Liquid', 'Fairy, 780ml', 'household', 1, 250, null, true);

  insert into basket_items (plan_id, tesco_product_id, name, subtitle, category, quantity, unit_price, original_unit_price, own_brand_available)
  values (v_plan_id, '254656551', 'Almond Milk', 'Alpro, 1L', 'cupboard', 2, 225, null, false)
  returning id into b_milk;
  insert into basket_allocations (basket_item_id, user_id, share) values (b_milk, maya_id, 1);

  -- Substitutions awaiting review on the reconciliation screen.
  insert into substitutions (basket_item_id, ordered_name, ordered_price, received_name, received_price, decision) values
    (b_soured, 'Yeo Valley Soured Cream 300ml', 120, 'Tesco Soured Cream 300ml', 95, 'pending'),
    (b_pasta,  'Barilla Penne 500g',            120, 'Napolina Penne 500g',      145, 'pending');

  -- Pantry -------------------------------------------------------------------

  insert into pantry_items (house_id, ingredient_id, quantity_remaining, unit, is_shared, low_stock) values
    (v_house_id, i_olive_oil, 15,  '%',      true, true),
    (v_house_id, i_penne,     800, 'g',      true, false),
    (v_house_id, i_garlic,    4,   'cloves', true, true),
    (v_house_id, i_oat_milk,  20,  '%',      true, true),
    (v_house_id, i_noodles,   6,   'nests',  true, false),
    (v_house_id, i_soy,       60,  '%',      true, false),
    (v_house_id, i_gravy,     70,  '%',      true, false);

  insert into pantry_items (house_id, ingredient_id, quantity_remaining, unit, is_shared, owner_user_id, low_stock)
  values (v_house_id, i_soured_cream, 1, 'tub', false, maya_id, false);

  raise notice 'Seeded house % with plan %', v_house_id, v_plan_id;
end $$;
