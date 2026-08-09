-- Pack data for the basket optimiser.
--
-- You cannot turn "we need 900g of pasta" into a shop without knowing what a
-- pack contains and costs. Until lib/tesco/ lands there is no product feed, so
-- the house records this once per ingredient and it is reused every week.
--
-- All three stay nullable. An ingredient with no pack data still appears on the
-- basket as a quantity to buy — it just cannot be priced or split yet, and the
-- UI says so rather than showing a fabricated £0.00.

alter table ingredients
  add column if not exists pack_size  numeric(10, 2) check (pack_size > 0),
  add column if not exists pack_unit  text,
  add column if not exists pack_price integer check (pack_price >= 0);

comment on column ingredients.pack_size  is 'Quantity in one purchasable pack, in pack_unit.';
comment on column ingredients.pack_unit  is 'Unit of pack_size — must be convertible to the recipe unit.';
comment on column ingredients.pack_price is 'Price of one pack, in integer pence.';

-- Where a basket line came from, so savings can be explained rather than
-- asserted. Written by the optimiser alongside basket_items.
alter table basket_items
  add column if not exists ingredient_id uuid references ingredients (id) on delete set null,
  -- Packs the house would have bought if every meal shopped separately.
  add column if not exists packs_if_separate integer check (packs_if_separate >= 0),
  -- Packs avoided because the pantry already covered part of the need.
  add column if not exists packs_from_pantry integer check (packs_from_pantry >= 0);

create index if not exists basket_items_ingredient_idx on basket_items (ingredient_id);
