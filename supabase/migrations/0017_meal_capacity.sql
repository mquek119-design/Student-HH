-- Whose meal it is, and how many it feeds.
--
-- Two columns, one migration, because they answer one question together: a cap
-- without an owner is a control anybody at the table can use on anybody else's
-- pan, which is not what "I'm cooking for three" means.
--
-- Safe to re-run — every statement is guarded.

-- ---------------------------------------------------------------------------
-- 1. Whose meal it is
-- ---------------------------------------------------------------------------
--
-- `cooked_by_user_id` was the closest thing to this and it is not the same
-- thing: the cook can change hands during the week, and the person now holding
-- the pan is not necessarily the person whose plan it was. Recipes have had
-- `created_by` since 0001 for exactly this reason; meals should too.

alter table planned_meals
  add column if not exists created_by uuid references profiles (id) on delete set null;

comment on column planned_meals.created_by is
  'Who put this meal on the plan. Owns the capacity setting; may hand the cook '
  'to someone else without handing over that decision.';

-- Existing rows: the cook is the best available guess, because addMealToPlan
-- has always set cooked_by_user_id to whoever created the meal.
update planned_meals
   set created_by = cooked_by_user_id
 where created_by is null
   and cooked_by_user_id is not null;

-- ---------------------------------------------------------------------------
-- 2. How many it feeds
-- ---------------------------------------------------------------------------
--
-- "Join" was unconditional, which is right most of the time — two people on one
-- recipe is the outcome the whole app is built to produce. But a pan holds what
-- it holds, and somebody cooking for two should be able to say so without it
-- becoming an argument on Sunday night.
--
-- One nullable integer does both jobs:
--
--   null  — open. Anyone may join. The default, and the common case.
--   n     — cooked for n mouths. Join is refused once that many are in.
--
-- Setting `n` to the number already eating is how a meal gets closed, so there
-- is no separate "locked" flag to keep in step with a count.
--
-- It counts MOUTHS, not housemates: a guest eats out of the same pan.
--
-- Deliberately NOT retroactive. Lowering the cap below the people already in
-- never removes anyone — it only stops the next person. Kicking a housemate off
-- a meal they had planned around is not something a stepper should be able to
-- do by accident, and after the order it would move their money as well.

alter table planned_meals
  add column if not exists max_diners integer check (max_diners is null or max_diners > 0);

comment on column planned_meals.max_diners is
  'Mouths this meal is cooked for, guests included. Null = open to anyone. '
  'Blocks new joins only; never removes an existing participant. Set by created_by.';
