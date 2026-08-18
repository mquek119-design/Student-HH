-- Structured payment details.
--
-- These were a single free-text field. That was defensible while the app only
-- displayed them, but in practice a housemate reads these to type a transfer,
-- and free text lets someone leave out the sort code, transpose digits, or
-- write "same as last time". Separate fields make an incomplete entry visible
-- at the point it is typed rather than at the point money moves.
--
-- The app still takes NO custody of funds and never contacts a bank. Validating
-- the shape of a sort code is a typo guard, not a payment integration.
--
-- `payment_details_text` is kept: it holds anything that does not fit the
-- fields (a building society roll number, "ask me on WhatsApp"), and existing
-- rows keep working until their owner fills the new fields in.

alter table profiles
  add column if not exists payment_bank_name      text,
  add column if not exists payment_sort_code      text,
  add column if not exists payment_account_number text,
  add column if not exists payment_link           text;

comment on column profiles.payment_bank_name is
  'Bank or app name, e.g. "Monzo". Display only.';
comment on column profiles.payment_sort_code is
  'Six digits, stored normalised as 00-00-00. Never used to move money.';
comment on column profiles.payment_account_number is
  'Eight digits. Never used to move money.';
comment on column profiles.payment_link is
  'A payment link or tag, e.g. monzo.me/name or a Revolut @tag.';
comment on column profiles.payment_details_text is
  'Free-text extras that do not fit the structured fields above.';

-- Shape only, and only when present. A half-typed sort code should be caught,
-- but nobody should be blocked from saving just a Monzo link.
alter table profiles drop constraint if exists profiles_sort_code_shape;
alter table profiles add constraint profiles_sort_code_shape check (
  payment_sort_code is null or payment_sort_code ~ '^\d{2}-\d{2}-\d{2}$'
);

alter table profiles drop constraint if exists profiles_account_number_shape;
alter table profiles add constraint profiles_account_number_shape check (
  payment_account_number is null or payment_account_number ~ '^\d{6,8}$'
);
