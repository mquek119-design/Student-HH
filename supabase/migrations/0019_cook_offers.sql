-- Handing the cooking over is an offer, not an instruction.
--
-- `cooked_by_user_id` could be set by anybody in the house, on any meal,
-- including one they were not eating — `setCook` validated that the *target*
-- was a diner and never checked the caller at all. So a housemate could put
-- your name against Thursday's dinner and the first you knew of it was the
-- reminder on the day.
--
-- The rule now:
--
--   * whoever adds the meal is the cook, automatically;
--   * only the current cook can hand it over, and doing so creates a pending
--     offer rather than an assignment;
--   * the person offered it accepts or declines — until they accept, the
--     original cook is still cooking;
--   * a cook may stand down, leaving the meal unclaimed for any diner to take.
--
-- One nullable column carries the pending state. Null means nothing is
-- outstanding, which is the normal case.

alter table planned_meals
  add column if not exists cook_offer_to uuid references profiles (id) on delete set null;

comment on column planned_meals.cook_offer_to is
  'Housemate who has been asked to take the cooking, and has not yet answered. '
  'Null when there is no outstanding offer. Accepting moves them into '
  'cooked_by_user_id and clears this; declining just clears it.';

-- You cannot offer the cooking to whoever is already doing it.
alter table planned_meals drop constraint if exists planned_meals_cook_offer_not_self;
alter table planned_meals add constraint planned_meals_cook_offer_not_self check (
  cook_offer_to is null or cook_offer_to is distinct from cooked_by_user_id
);
