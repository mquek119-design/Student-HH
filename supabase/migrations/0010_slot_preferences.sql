-- Optional slot preferences for a house.
--
-- Every column here is NULLABLE and stays null for households that never set
-- one. These are a *hint* used to suggest a slot, never a decision: the
-- collector always picks the actual slot themselves. A house that skips this
-- screen entirely must get a perfectly usable picker.
--
-- Deliberately separate from `houses.fulfillment_method` (0005), which is NOT
-- NULL with a default and therefore cannot express "no preference". That column
-- stays as the setting the Tesco checkout browser flow reads;
-- `preferred_fulfillment_method` is only ever a suggestion.

alter table houses
  add column if not exists preferred_fulfillment_method text
    check (preferred_fulfillment_method in ('delivery', 'collect')),
  add column if not exists preferred_day weekday,
  add column if not exists preferred_window_start time,
  add column if not exists preferred_window_end   time;

comment on column houses.preferred_fulfillment_method is
  'Optional. Suggests which tab the slot picker opens on. Null = no preference.';
comment on column houses.preferred_day is
  'Optional. Weekday the house would rather receive the shop.';
comment on column houses.preferred_window_start is
  'Optional. Start of the preferred time window, e.g. 17:00.';
comment on column houses.preferred_window_end is
  'Optional. End of the preferred time window, e.g. 21:00.';

-- A window needs both ends or neither, otherwise "best match" scoring has to
-- invent the missing half.
alter table houses drop constraint if exists houses_preferred_window_complete;
alter table houses add constraint houses_preferred_window_complete check (
  (preferred_window_start is null and preferred_window_end is null)
  or (preferred_window_start is not null and preferred_window_end is not null)
);
