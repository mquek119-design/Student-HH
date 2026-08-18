-- Items the house adds by hand, and staple splitting.
--
-- The basket is regenerated destructively from the plan, so anything not
-- derived from a recipe must be marked or a rebuild silently deletes it.
-- Washing-up liquid, snacks, milk for tea — none of these come from a recipe,
-- and without this there is no way to buy them at all.

alter table basket_items
  add column if not exists is_manual boolean not null default false;

comment on column basket_items.is_manual is
  'True for items added by hand. The optimiser must preserve these across a rebuild.';

create index if not exists basket_items_manual_idx on basket_items (plan_id, is_manual);

-- `houses.shared_staples_enabled` has existed since 0001 and nothing ever read
-- it. It now means: household-category lines are split equally across everyone
-- rather than attributed to whoever's meals happened to name them. Nobody
-- "orders" washing-up liquid on behalf of one recipe.
comment on column houses.shared_staples_enabled is
  'When true, household-category basket lines split equally across all housemates instead of by meal participation.';
