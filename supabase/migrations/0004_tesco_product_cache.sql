-- Cache the Tesco product chosen for each ingredient.
--
-- Search is unauthenticated and fast, but re-resolving every ingredient on
-- every basket rebuild is both slow and needlessly chatty toward Tesco. The
-- pack columns added in 0003 stop being something the house types in and
-- become a cache of what search returned; this records which product they came
-- from so it can be re-checked or swapped later.

alter table ingredients
  add column if not exists tesco_product_id text,
  add column if not exists tesco_title      text,
  add column if not exists tesco_synced_at  timestamptz;

comment on column ingredients.tesco_product_id is 'TPNB of the product the optimiser picked.';
comment on column ingredients.tesco_title      is 'Product title as shown by Tesco, e.g. "Tesco Penne Pasta Quills 500G".';
comment on column ingredients.tesco_synced_at  is 'When pack_size/pack_price were last refreshed from search.';

create index if not exists ingredients_tesco_product_idx on ingredients (tesco_product_id);

-- ---------------------------------------------------------------------------
-- Missing UPDATE policy (bug fix)
-- ---------------------------------------------------------------------------
--
-- 0002 gave `ingredients` SELECT and INSERT policies but no UPDATE. RLS denies
-- anything not explicitly allowed, so writing resolved pack data back would
-- have failed for every ingredient — the cache above could never be populated.
--
-- Scope note: `ingredients` is a deliberately global catalogue (0002 grants
-- SELECT to all authenticated users), because "penne pasta" means the same
-- thing everywhere and Tesco pricing is national. That makes this cache shared
-- across houses, which is a feature while every house wants the cheapest
-- match. The moment houses want *different* products for the same ingredient
-- — own-brand versus branded — this needs splitting into a per-house
-- `house_ingredient_products` table. It is not that yet.
create policy ingredients_update on ingredients
  for update to authenticated
  using (true)
  with check (true);
