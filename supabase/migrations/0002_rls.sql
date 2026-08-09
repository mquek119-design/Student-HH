-- HouseGrocer — row level security
--
-- Rule: you can see and touch exactly what belongs to your house, and nothing
-- else. A house is the privacy boundary — there is no cross-house sharing.
--
-- IMPORTANT: all house lookups go through SECURITY DEFINER helpers. A policy
-- that queries another table inline has that table's own RLS applied, which
-- either recurses (profiles checking profiles) or silently denies. The helpers
-- run as owner, so they resolve once and cleanly.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function current_house_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select house_id from profiles where id = auth.uid();
$$;

create or replace function is_house_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

create or replace function plan_house_id(p_plan_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select house_id from weekly_plans where id = p_plan_id;
$$;

create or replace function planned_meal_house_id(p_meal_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select wp.house_id
  from planned_meals pm
  join weekly_plans wp on wp.id = pm.plan_id
  where pm.id = p_meal_id;
$$;

create or replace function basket_item_house_id(p_item_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select wp.house_id
  from basket_items bi
  join weekly_plans wp on wp.id = bi.plan_id
  where bi.id = p_item_id;
$$;

create or replace function recipe_is_visible(p_recipe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from recipes r
    where r.id = p_recipe_id
      and (r.house_id is null or r.house_id = current_house_id())
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

alter table houses              enable row level security;
alter table profiles            enable row level security;
alter table ingredients         enable row level security;
alter table recipes             enable row level security;
alter table recipe_ingredients  enable row level security;
alter table weekly_plans        enable row level security;
alter table planned_meals       enable row level security;
alter table meal_participants   enable row level security;
alter table basket_items        enable row level security;
alter table basket_allocations  enable row level security;
alter table splits              enable row level security;
alter table pantry_items        enable row level security;
alter table substitutions       enable row level security;
alter table delivery_receipts   enable row level security;

-- ---------------------------------------------------------------------------
-- Houses
-- ---------------------------------------------------------------------------

create policy houses_select on houses
  for select to authenticated
  using (id = current_house_id());

-- Anyone signed in may create a house; they become its first member.
create policy houses_insert on houses
  for insert to authenticated
  with check (true);

create policy houses_update on houses
  for update to authenticated
  using (id = current_house_id() and is_house_admin())
  with check (id = current_house_id());

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

-- You always see yourself, plus everyone in your house.
create policy profiles_select on profiles
  for select to authenticated
  using (id = auth.uid() or (house_id is not null and house_id = current_house_id()));

create policy profiles_insert on profiles
  for insert to authenticated
  with check (id = auth.uid());

-- You may only edit your own row. Joining a house is done through the
-- join_house() function, which validates the invite code.
create policy profiles_update on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Ingredients — a shared global catalogue, readable by all, appendable by all.
-- ---------------------------------------------------------------------------

create policy ingredients_select on ingredients
  for select to authenticated using (true);

create policy ingredients_insert on ingredients
  for insert to authenticated with check (true);

-- ---------------------------------------------------------------------------
-- Recipes
-- ---------------------------------------------------------------------------

create policy recipes_select on recipes
  for select to authenticated
  using (house_id is null or house_id = current_house_id());

create policy recipes_insert on recipes
  for insert to authenticated
  with check (house_id = current_house_id());

create policy recipes_update on recipes
  for update to authenticated
  using (house_id = current_house_id())
  with check (house_id = current_house_id());

create policy recipes_delete on recipes
  for delete to authenticated
  using (house_id = current_house_id());

create policy recipe_ingredients_select on recipe_ingredients
  for select to authenticated
  using (recipe_is_visible(recipe_id));

create policy recipe_ingredients_write on recipe_ingredients
  for all to authenticated
  using (recipe_is_visible(recipe_id))
  with check (recipe_is_visible(recipe_id));

-- ---------------------------------------------------------------------------
-- Weekly plans and meals
-- ---------------------------------------------------------------------------

create policy weekly_plans_all on weekly_plans
  for all to authenticated
  using (house_id = current_house_id())
  with check (house_id = current_house_id());

create policy planned_meals_all on planned_meals
  for all to authenticated
  using (plan_house_id(plan_id) = current_house_id())
  with check (plan_house_id(plan_id) = current_house_id());

create policy meal_participants_all on meal_participants
  for all to authenticated
  using (planned_meal_house_id(planned_meal_id) = current_house_id())
  with check (planned_meal_house_id(planned_meal_id) = current_house_id());

-- ---------------------------------------------------------------------------
-- Basket
-- ---------------------------------------------------------------------------

create policy basket_items_all on basket_items
  for all to authenticated
  using (plan_house_id(plan_id) = current_house_id())
  with check (plan_house_id(plan_id) = current_house_id());

create policy basket_allocations_all on basket_allocations
  for all to authenticated
  using (basket_item_house_id(basket_item_id) = current_house_id())
  with check (basket_item_house_id(basket_item_id) = current_house_id());

-- ---------------------------------------------------------------------------
-- Settlement
-- ---------------------------------------------------------------------------

create policy splits_select on splits
  for select to authenticated
  using (plan_house_id(plan_id) = current_house_id());

create policy splits_insert on splits
  for insert to authenticated
  with check (plan_house_id(plan_id) = current_house_id());

-- Either side of a split may move it along: the payer marks it notified, the
-- collector confirms or disputes. Both are in-house by construction.
create policy splits_update on splits
  for update to authenticated
  using (
    plan_house_id(plan_id) = current_house_id()
    and (from_user_id = auth.uid() or to_user_id = auth.uid())
  )
  with check (plan_house_id(plan_id) = current_house_id());

-- ---------------------------------------------------------------------------
-- Pantry
-- ---------------------------------------------------------------------------

-- Shared pantry is visible house-wide; a personal item only to its owner.
create policy pantry_items_select on pantry_items
  for select to authenticated
  using (
    house_id = current_house_id()
    and (is_shared or owner_user_id = auth.uid())
  );

create policy pantry_items_write on pantry_items
  for all to authenticated
  using (
    house_id = current_house_id()
    and (is_shared or owner_user_id = auth.uid())
  )
  with check (
    house_id = current_house_id()
    and (is_shared or owner_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Reconciliation
-- ---------------------------------------------------------------------------

create policy substitutions_all on substitutions
  for all to authenticated
  using (basket_item_house_id(basket_item_id) = current_house_id())
  with check (basket_item_house_id(basket_item_id) = current_house_id());

create policy delivery_receipts_all on delivery_receipts
  for all to authenticated
  using (basket_item_house_id(basket_item_id) = current_house_id())
  with check (basket_item_house_id(basket_item_id) = current_house_id());

-- ---------------------------------------------------------------------------
-- Joining a house
-- ---------------------------------------------------------------------------

-- Invite codes are the one thing a non-member legitimately needs to resolve, so
-- this runs SECURITY DEFINER rather than exposing houses to unauthenticated
-- select. It returns nothing on a bad code — never an error that would let a
-- caller enumerate valid codes by timing or message.
create or replace function join_house(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_house uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select id into target_house
  from houses
  where upper(invite_code) = upper(trim(p_invite_code));

  if target_house is null then
    return null;
  end if;

  update profiles set house_id = target_house where id = auth.uid();

  return target_house;
end;
$$;

revoke all on function join_house(text) from public;
grant execute on function join_house(text) to authenticated;

-- Creating a house and becoming its admin + collector has to happen atomically,
-- otherwise a failure between the two leaves an orphan house with no members.
create or replace function create_house(
  p_name          text,
  p_delivery_day  weekday default 'mon',
  p_cutoff_day    weekday default 'sun',
  p_cutoff_time   time default '17:00'
)
returns houses
language plpgsql
security definer
set search_path = public
as $$
declare
  new_house houses;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into houses (name, delivery_day, cutoff_day, cutoff_time, collector_user_id)
  values (p_name, p_delivery_day, p_cutoff_day, p_cutoff_time, auth.uid())
  returning * into new_house;

  update profiles
  set house_id = new_house.id,
      is_admin = true
  where id = auth.uid();

  return new_house;
end;
$$;

revoke all on function create_house(text, weekday, weekday, time) from public;
grant execute on function create_house(text, weekday, weekday, time) to authenticated;
