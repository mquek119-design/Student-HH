-- Quantities the optimiser could not calculate.
--
-- When a recipe counts items ("3 garlic cloves") and Tesco sells the thing by
-- weight (a 190g jar), there is no arithmetic that converts one into the other.
-- The old behaviour was to drop the line: no price, no total, no split — which
-- the basket rendered as £0.00 and everybody was undercharged for.
--
-- Now the line buys one pack and says so. This column is what lets the basket
-- show that it was an assumption rather than a calculation, which is the whole
-- difference between a figure you can trust and one you cannot.

alter table basket_items
  add column if not exists quantity_assumed boolean not null default false;

comment on column basket_items.quantity_assumed is
  'True when pack count could not be derived (counted recipe vs weighed pack) '
  'and one pack was assumed. Displayed to the collector for checking.';
