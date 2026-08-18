-- Two people typing the same ingredient must land on the same row.
--
-- The optimiser pools by `ingredient_id`, so the entire claim of this app — one
-- bigger pack instead of two small ones — depends on "Chicken breast" and
-- "chicken breasts" being one ingredient. They were not.
--
-- Every call site looked an ingredient up with `ilike('name', x)`, which is
-- case-insensitive but otherwise an exact match. A plural made a second row,
-- the shop bought both, and the saving was reported as zero. Silently: no
-- error, no warning, nothing on screen to suggest anything had gone wrong.
--
-- `canonical_name` is what matching happens on from now on. `name` keeps
-- whatever the housemate typed, because that is what they should see.

alter table ingredients
  add column if not exists canonical_name text;

comment on column ingredients.canonical_name is
  'Normalised key for matching: lowercase, leading qualifiers stripped, '
  'trailing plural removed. src/lib/ingredients.ts canonicalName() is the '
  'authority. `name` remains the display string as typed.';

-- A floor, not the answer. This catches case and whitespace only; the plural
-- and qualifier rules live in TypeScript, where they can be tested. Rows
-- written before this migration keep whatever this produces until either they
-- are touched again or the merge tool on /dev is run.
update ingredients
   set canonical_name = lower(trim(name))
 where canonical_name is null;

-- **Not unique, deliberately.** Existing tables already contain duplicates that
-- differ only by plural — that is the bug being fixed — so a unique index here
-- would fail on real data, and a migration that cannot be applied is worse than
-- a missing constraint. Add uniqueness in a follow-up once /dev → Merge
-- ingredients reports no remaining clusters.
create index if not exists ingredients_canonical_name_idx
  on ingredients (canonical_name);

-- The original stays: it still stops two rows with an identical display name.
-- create unique index ingredients_name_key on ingredients (lower(name));
