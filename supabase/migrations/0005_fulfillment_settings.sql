-- Fulfillment settings on houses.
--
-- Guarded so a re-run is safe. The original version used bare ADD COLUMN, which
-- fails the second time — and "run it again" is the first thing anyone tries
-- when a migration set is half applied.

alter table houses
  add column if not exists fulfillment_method text not null default 'collect'
    check (fulfillment_method in ('collect', 'delivery')),
  add column if not exists delivery_postcode text,
  add column if not exists click_collect_store text not null
    default 'coventry cannon park rear car park 1';
