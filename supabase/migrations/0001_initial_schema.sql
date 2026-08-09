-- HouseGrocer — initial schema
--
-- Conventions:
--   * All money is integer pence. Never store pounds as numeric/float.
--   * Every house-scoped table carries house_id directly (denormalised where
--     needed) so RLS policies stay single-join and cheap.
--   * Timestamps are timestamptz. Dates that mean "a calendar day in the UK"
--     (week_start_date, added_date) are plain date.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type weekday as enum ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');
create type meal_type as enum ('breakfast', 'lunch', 'dinner');
create type plan_status as enum ('planning', 'locked', 'ordered', 'delivered');
create type split_status as enum ('pending', 'notified', 'confirmed', 'disputed');
create type ingredient_category as enum ('fresh', 'cupboard', 'frozen', 'household');
create type substitution_decision as enum ('pending', 'accepted', 'rejected');
create type recipe_difficulty as enum ('easy', 'medium', 'hard');
create type avatar_accent as enum ('green', 'orange', 'blue', 'purple');

-- ---------------------------------------------------------------------------
-- Houses
-- ---------------------------------------------------------------------------

create table houses (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null check (length(trim(name)) between 1 and 60),
  invite_code            text not null unique,
  delivery_day           weekday not null default 'mon',
  delivery_time          time not null default '18:00',
  cutoff_day             weekday not null default 'sun',
  cutoff_time            time not null default '17:00',
  -- Set after the creator's profile exists; FK added below to break the cycle.
  collector_user_id      uuid,
  shared_staples_enabled boolean not null default true,
  created_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------

create table profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  name                 text not null check (length(trim(name)) between 1 and 60),
  email                text not null,
  house_id             uuid references houses (id) on delete set null,
  room                 text,
  avatar_url           text,
  accent               avatar_accent not null default 'green',
  dietary_preferences  text[] not null default '{}',
  -- Free text, displayed verbatim. The app never processes payments, so this is
  -- deliberately unstructured and never validated as bank detail.
  payment_details_text text,
  is_admin             boolean not null default false,
  created_at           timestamptz not null default now()
);

create index profiles_house_id_idx on profiles (house_id);

alter table houses
  add constraint houses_collector_fk
  foreign key (collector_user_id) references profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Ingredients & recipes
-- ---------------------------------------------------------------------------

create table ingredients (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  default_unit text not null default 'g',
  category     ingredient_category not null default 'cupboard'
);

create unique index ingredients_name_key on ingredients (lower(name));

create table recipes (
  id              uuid primary key default gen_random_uuid(),
  -- null house_id = global recipe available to everyone.
  house_id        uuid references houses (id) on delete cascade,
  created_by      uuid references profiles (id) on delete set null,
  title           text not null,
  source_url      text,
  image_url       text,
  cook_time_mins  integer not null default 30 check (cook_time_mins > 0),
  difficulty      recipe_difficulty not null default 'easy',
  servings        integer not null default 4 check (servings > 0),
  cost_per_portion integer not null default 0 check (cost_per_portion >= 0),
  tags            text[] not null default '{}',
  instructions    text[] not null default '{}',
  pro_tip         text,
  created_at      timestamptz not null default now()
);

create index recipes_house_id_idx on recipes (house_id);

create table recipe_ingredients (
  recipe_id     uuid not null references recipes (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id) on delete restrict,
  quantity      numeric(10, 2) not null check (quantity > 0),
  unit          text not null,
  primary key (recipe_id, ingredient_id)
);

-- ---------------------------------------------------------------------------
-- Weekly plans
-- ---------------------------------------------------------------------------

create table weekly_plans (
  id              uuid primary key default gen_random_uuid(),
  house_id        uuid not null references houses (id) on delete cascade,
  week_start_date date not null,
  week_number     integer not null,
  status          plan_status not null default 'planning',
  cutoff_at       timestamptz not null,
  shared_savings  integer not null default 0,
  created_at      timestamptz not null default now(),
  unique (house_id, week_start_date)
);

create index weekly_plans_house_status_idx on weekly_plans (house_id, status);

create table planned_meals (
  id                uuid primary key default gen_random_uuid(),
  plan_id           uuid not null references weekly_plans (id) on delete cascade,
  recipe_id         uuid not null references recipes (id) on delete restrict,
  day               weekday not null,
  meal_type         meal_type not null default 'dinner',
  is_shared         boolean not null default false,
  cooked_by_user_id uuid references profiles (id) on delete set null
);

create index planned_meals_plan_id_idx on planned_meals (plan_id);

create table meal_participants (
  planned_meal_id uuid not null references planned_meals (id) on delete cascade,
  user_id         uuid not null references profiles (id) on delete cascade,
  opted_out       boolean not null default false,
  primary key (planned_meal_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Basket
-- ---------------------------------------------------------------------------

create table basket_items (
  id                  uuid primary key default gen_random_uuid(),
  plan_id             uuid not null references weekly_plans (id) on delete cascade,
  tesco_product_id    text,
  name                text not null,
  subtitle            text not null default '',
  image_url           text,
  category            ingredient_category not null default 'cupboard',
  quantity            integer not null default 1 check (quantity > 0),
  unit_price          integer not null check (unit_price >= 0),
  -- Pre-swap price when an own-brand alternative was substituted in.
  original_unit_price integer check (original_unit_price >= 0),
  own_brand_available boolean not null default false,
  created_at          timestamptz not null default now()
);

create index basket_items_plan_id_idx on basket_items (plan_id);

-- No rows for an item means "split equally across the whole house".
-- `share` is a relative weight, not a fraction — see splitPence() in money.ts.
create table basket_allocations (
  basket_item_id uuid not null references basket_items (id) on delete cascade,
  user_id        uuid not null references profiles (id) on delete cascade,
  share          numeric(10, 4) not null default 1 check (share > 0),
  primary key (basket_item_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Settlement
-- ---------------------------------------------------------------------------

create table splits (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references weekly_plans (id) on delete cascade,
  from_user_id uuid not null references profiles (id) on delete cascade,
  to_user_id   uuid not null references profiles (id) on delete cascade,
  amount       integer not null check (amount >= 0),
  status       split_status not null default 'pending',
  note         text not null default '',
  created_at   timestamptz not null default now(),
  unique (plan_id, from_user_id, to_user_id),
  check (from_user_id <> to_user_id)
);

create index splits_from_user_idx on splits (from_user_id);
create index splits_to_user_idx on splits (to_user_id);

-- ---------------------------------------------------------------------------
-- Pantry
-- ---------------------------------------------------------------------------

create table pantry_items (
  id                 uuid primary key default gen_random_uuid(),
  house_id           uuid not null references houses (id) on delete cascade,
  ingredient_id      uuid not null references ingredients (id) on delete restrict,
  quantity_remaining numeric(10, 2) not null default 0 check (quantity_remaining >= 0),
  unit               text not null default 'g',
  added_date         date not null default current_date,
  is_shared          boolean not null default true,
  owner_user_id      uuid references profiles (id) on delete cascade,
  low_stock          boolean not null default false,
  -- A personal item must name its owner; a shared item must not.
  check ((is_shared and owner_user_id is null) or (not is_shared and owner_user_id is not null))
);

create index pantry_items_house_id_idx on pantry_items (house_id);

-- ---------------------------------------------------------------------------
-- Reconciliation
-- ---------------------------------------------------------------------------

create table substitutions (
  id             uuid primary key default gen_random_uuid(),
  basket_item_id uuid not null references basket_items (id) on delete cascade,
  ordered_name   text not null,
  ordered_price  integer not null check (ordered_price >= 0),
  received_name  text not null,
  received_price integer not null check (received_price >= 0),
  decision       substitution_decision not null default 'pending'
);

create index substitutions_basket_item_idx on substitutions (basket_item_id);

-- Recorded at delivery: what actually turned up, against what was ordered.
create table delivery_receipts (
  basket_item_id    uuid primary key references basket_items (id) on delete cascade,
  received          boolean not null default true,
  received_quantity integer not null default 0 check (received_quantity >= 0),
  recorded_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Invite codes
-- ---------------------------------------------------------------------------

-- Human-readable and phone-friendly: 4 letters, a dash, 4 digits (ELLE-4482).
-- Ambiguous glyphs (I, O) are excluded so codes survive being read aloud.
create or replace function generate_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  candidate text;
  attempts  integer := 0;
begin
  loop
    candidate := '';
    for i in 1..4 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    candidate := candidate || '-' || lpad(floor(random() * 10000)::text, 4, '0');

    exit when not exists (select 1 from houses where invite_code = candidate);

    attempts := attempts + 1;
    if attempts > 50 then
      raise exception 'Could not generate a unique invite code after 50 attempts';
    end if;
  end loop;

  return candidate;
end;
$$;

alter table houses alter column invite_code set default generate_invite_code();

-- ---------------------------------------------------------------------------
-- New-user bootstrap
-- ---------------------------------------------------------------------------

-- Every auth.users row gets a profile immediately, with no house. Onboarding
-- then either creates a house or joins one by code.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, accent)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    (array['green', 'orange', 'blue', 'purple']::avatar_accent[])[1 + floor(random() * 4)::int]
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Attaching a trigger to auth.users needs ownership of that table. On managed
-- Supabase projects auth.users belongs to supabase_auth_admin, so the SQL
-- editor's postgres role is refused with "must be owner of relation users".
--
-- The SQL editor runs this file as ONE transaction, so letting that error
-- propagate would roll back every table above it — the whole migration would
-- silently do nothing. Swallow it instead: the app creates missing profiles on
-- first sign-in (see ensureProfile in src/lib/queries.ts), so the trigger is a
-- nicety, not a requirement.
do $$
begin
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_user();
  raise notice 'Installed on_auth_user_created trigger.';
exception
  when insufficient_privilege or others then
    raise notice
      'Skipped on_auth_user_created trigger (%). Profiles are created by the app on first sign-in instead.',
      sqlerrm;
end $$;
