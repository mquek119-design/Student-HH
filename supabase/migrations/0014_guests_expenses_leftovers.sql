-- Guests, one-off purchases, and the leftovers board.
--
-- Three things a shared house does constantly that the schema had no room for:
-- someone brings a mate to dinner, someone buys a toaster, someone cooks too
-- much chilli. All three end up in the same place — the ledger or the pantry —
-- so none of them needed a new concept, only a place to record the fact.

-- ---------------------------------------------------------------------------
-- 1. Guests
-- ---------------------------------------------------------------------------
--
-- A guest is not a housemate: they have no account, no balance and no say in
-- the plan. They are extra mouths attached to the person who invited them, and
-- the only two questions that matter are how many, and who pays.
--
-- `guests_covered` is that second question:
--   true  — the host covers them. Their portion is bought and charged to the
--           host, which is the polite default and the one nobody argues about.
--   false — split across the table. Everyone eating agreed to feed them.

alter table meal_participants
  add column if not exists guests integer not null default 0 check (guests >= 0 and guests <= 6),
  add column if not exists guests_covered boolean not null default true;

comment on column meal_participants.guests is
  'Extra mouths this person is bringing. Scales the recipe and the shop.';
comment on column meal_participants.guests_covered is
  'True: the host pays for their guests. False: the table splits them.';

-- Someone who is not eating cannot bring anyone.
alter table meal_participants drop constraint if exists meal_participants_guests_need_host;
alter table meal_participants add constraint meal_participants_guests_need_host check (
  guests = 0 or not opted_out
);

-- ---------------------------------------------------------------------------
-- 2. One-off purchases
-- ---------------------------------------------------------------------------
--
-- Deliberately NOT modelled as a `split` row. Splits are *derived*: rebuilt
-- from basket allocations, tied to `plan_id not null`, and safe to recompute
-- because nothing in them was typed by a human. A shower curtain from Wilko is
-- the opposite — hand-entered, unverifiable, and the one thing a rebuild must
-- never touch. Making `plan_id` nullable would have put both in one table and
-- one recompute away from deleting somebody's £40.
--
-- Shares are stored as resolved pence rather than weights. An equal split of
-- £10 three ways is 334/333/333 at the moment it is entered, and it stays that
-- way — nobody should be able to change the arithmetic of a debt after the fact
-- by editing a rounding rule.

create table if not exists expenses (
  id              uuid primary key default gen_random_uuid(),
  house_id        uuid not null references houses (id) on delete cascade,
  paid_by_user_id uuid not null references profiles (id) on delete cascade,
  description     text not null check (length(trim(description)) > 0),
  amount          integer not null check (amount > 0),
  spent_on        date not null default current_date,
  -- No photo upload: there is no storage bucket, and a receipt image is a
  -- separate infrastructure decision. This is where "receipt's in the drawer"
  -- goes in the meantime.
  note            text not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists expenses_house_id_idx on expenses (house_id);

create table if not exists expense_shares (
  expense_id uuid not null references expenses (id) on delete cascade,
  user_id    uuid not null references profiles (id) on delete cascade,
  amount     integer not null check (amount >= 0),
  settled    boolean not null default false,
  primary key (expense_id, user_id)
);

comment on table expenses is
  'Hand-entered purchases made outside the weekly Tesco shop. Never derived, '
  'never rebuilt — a basket rebuild must not be able to touch these.';
comment on column expense_shares.amount is
  'Resolved pence, fixed at entry. The shares of an expense sum to its amount.';

alter table expenses       enable row level security;
alter table expense_shares enable row level security;

drop policy if exists expenses_all on expenses;
create policy expenses_all on expenses
  for all to authenticated
  using (house_id = current_house_id())
  with check (house_id = current_house_id());

create or replace function expense_house_id(p_expense_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select house_id from expenses where id = p_expense_id;
$$;

drop policy if exists expense_shares_all on expense_shares;
create policy expense_shares_all on expense_shares
  for all to authenticated
  using (expense_house_id(expense_id) = current_house_id())
  with check (expense_house_id(expense_id) = current_house_id());

-- ---------------------------------------------------------------------------
-- 3. Leftovers
-- ---------------------------------------------------------------------------
--
-- A message board, not inventory. It carries no cost and never touches the
-- split: the food was paid for by whoever cooked it, and offering it round is a
-- gift. Claiming deletes the row, because a claimed leftover is a plate of food
-- and no longer anybody's business.

create table if not exists leftovers (
  id                uuid primary key default gen_random_uuid(),
  house_id          uuid not null references houses (id) on delete cascade,
  created_by        uuid not null references profiles (id) on delete cascade,
  description       text not null check (length(trim(description)) > 0),
  portions          integer not null default 1 check (portions > 0 and portions <= 20),
  made_on           date not null default current_date,
  -- Stored rather than computed so the window can differ per dish: a curry
  -- keeps, a fish pie does not.
  eat_by            date not null,
  created_at        timestamptz not null default now(),
  check (eat_by >= made_on)
);

create index if not exists leftovers_house_id_idx on leftovers (house_id);

alter table leftovers enable row level security;

drop policy if exists leftovers_all on leftovers;
create policy leftovers_all on leftovers
  for all to authenticated
  using (house_id = current_house_id())
  with check (house_id = current_house_id());
