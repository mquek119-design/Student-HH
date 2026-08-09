-- The delivery or collection slot chosen for a week's order.
--
-- The charge belongs here rather than being scraped off the checkout page at
-- preview time. Tesco only reveals a delivery cost once a slot is picked, and a
-- regex over the page body cannot tell an order total from a subtotal — a
-- misread there lands straight in the split.
--
-- `slot_charge` is integer pence like every other money column in this schema.
-- A collection slot is usually free, which is 0, not null: null means "no slot
-- chosen yet" and must stay distinguishable from "chosen and free".

alter table weekly_plans
  add column if not exists slot_id        text,
  add column if not exists slot_method    text check (slot_method in ('delivery', 'collect')),
  add column if not exists slot_starts_at timestamptz,
  add column if not exists slot_ends_at   timestamptz,
  add column if not exists slot_charge    integer check (slot_charge >= 0);

comment on column weekly_plans.slot_charge is
  'Delivery/collection charge in integer pence, as quoted by Tesco for the booked slot. Null = no slot chosen.';
