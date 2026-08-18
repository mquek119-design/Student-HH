-- Meal lifecycle, bailing, and the shared staples list.
--
-- Three related additions, all of them about what happens to a plan *after* the
-- order is placed — the part of the week the schema previously had no words for.
--
-- Until now a plan could only be `planning → ordered → delivered`, and a meal
-- was simply a row that existed. There was no way to say "we cooked that",
-- "nobody cooked that", or "I ended up out that night". That gap is why the app
-- went quiet the moment the shop arrived, which is precisely when a house most
-- needs it.

-- ---------------------------------------------------------------------------
-- 1. Meal status
-- ---------------------------------------------------------------------------

do $$
begin
  create type meal_status as enum ('planned', 'cooked', 'skipped', 'swapped');
exception
  when duplicate_object then null;
end $$;

alter table planned_meals
  add column if not exists status meal_status not null default 'planned';

comment on column planned_meals.status is
  'planned until the night happens. cooked/skipped are recorded by a diner; '
  'swapped means they cooked something else from the same ingredients. '
  'None of these move money — the food was bought and paid for either way.';

-- ---------------------------------------------------------------------------
-- 2. Bailing, as distinct from opting out
-- ---------------------------------------------------------------------------
--
-- The distinction is the entire money rule of the post-order week, so it is a
-- column and not a convention:
--
--   opted_out  — before the order. You are not eating it, so the ingredients
--                are not bought and your split never carries them.
--   bailed     — after the order. The food exists and you paid for your share
--                of it. It is yours. Nobody else's split changes.
--
-- A bailed participant therefore MUST stay on the meal. Deleting the row would
-- silently redistribute their cost onto their housemates, which is the exact
-- unfairness the per-item split exists to prevent.

alter table meal_participants
  add column if not exists bailed boolean not null default false;

comment on column meal_participants.bailed is
  'Set when someone drops out after the order. The row stays and the cost stays '
  'with them — the ingredients are already bought and are theirs. Never delete '
  'a bailed participant: that would move their cost onto everyone else.';

-- Cannot be both. Opting out happens before the shop; bailing happens after.
alter table meal_participants drop constraint if exists meal_participants_out_once;
alter table meal_participants add constraint meal_participants_out_once check (
  not (opted_out and bailed)
);

-- ---------------------------------------------------------------------------
-- 3. Shared household staples
-- ---------------------------------------------------------------------------
--
-- `houses.shared_staples_enabled` already existed, but it only changed how
-- household lines were *split*. Nothing ever put a household line in the basket
-- in the first place — recipes do not call for bin bags — so the flag governed
-- a category that was always empty. This is the missing half.
--
-- Each staple points at an `ingredients` row so it prices and pictures itself
-- through exactly the same Tesco resolution as food. No second product path.

do $$
begin
  create type staple_frequency as enum ('weekly', 'fortnightly', 'monthly');
exception
  when duplicate_object then null;
end $$;

create table if not exists house_staples (
  id            uuid primary key default gen_random_uuid(),
  house_id      uuid not null references houses (id) on delete cascade,
  ingredient_id uuid not null references ingredients (id) on delete restrict,
  frequency     staple_frequency not null default 'weekly',
  -- Null means "never yet added", which reads as due.
  last_added_on date,
  created_at    timestamptz not null default now(),
  unique (house_id, ingredient_id)
);

create index if not exists house_staples_house_id_idx on house_staples (house_id);

comment on table house_staples is
  'Non-food the house always needs: bin bags, washing-up liquid, kitchen roll. '
  'Added to the basket automatically when due and split equally.';
comment on column house_staples.last_added_on is
  'Set when a basket build includes this staple. Null = never added = due now.';

alter table house_staples enable row level security;

drop policy if exists house_staples_all on house_staples;
create policy house_staples_all on house_staples
  for all to authenticated
  using (house_id = current_house_id())
  with check (house_id = current_house_id());
