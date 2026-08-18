-- Writes the app cannot make on your behalf, and one it could never make at all.
--
-- ---------------------------------------------------------------------------
-- Why these exist
-- ---------------------------------------------------------------------------
--
-- `/dev` can render the whole app as a demo housemate, but impersonation only
-- changes who the *app* thinks you are — `auth.uid()` is still you, and RLS
-- reads `auth.uid()`. So two policies refused every time:
--
--   splits_update   … and (from_user_id = auth.uid() or to_user_id = auth.uid())
--   profiles_update … using (id = auth.uid())
--
-- which meant the settle-up flow — the exact thing the demo housemates exist to
-- test — could not be walked through. The documented workaround was a second
-- real account via a `you+maya@gmail.com` alias; there are no more addresses,
-- so the feature has to work properly.
--
-- These functions run as owner and check in SQL what RLS checks with
-- `auth.uid()`: that the caller and the target share a house, and **that the
-- target is a demo profile**. That second condition is the safety property.
-- A real housemate's split or profile is never reachable through here, whatever
-- is passed in.
--
-- Every one returns a row count so a zero can be reported rather than looking
-- like success.

-- ---------------------------------------------------------------------------
-- 1. Payment status, as a demo housemate
-- ---------------------------------------------------------------------------

create or replace function demo_set_split_status(
  p_split_id  uuid,
  p_status    split_status,
  p_acting_as uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house    uuid;
  v_target   record;
  v_changed  integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select house_id into v_house from profiles where id = auth.uid();
  if v_house is null then
    raise exception 'You are not in a house';
  end if;

  select house_id, is_demo into v_target from profiles where id = p_acting_as;
  if v_target is null or v_target.house_id is distinct from v_house then
    raise exception 'That housemate is not in your house';
  end if;
  if not v_target.is_demo then
    raise exception 'Only a demo housemate can be acted for';
  end if;

  with updated as (
    update splits
       set status = p_status
     where id = p_split_id
       and (from_user_id = p_acting_as or to_user_id = p_acting_as)
       and plan_house_id(plan_id) = v_house
    returning 1
  )
  select count(*) into v_changed from updated;

  return v_changed;
end;
$$;

revoke all on function demo_set_split_status(uuid, split_status, uuid) from public;
grant execute on function demo_set_split_status(uuid, split_status, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Profile details, as a demo housemate
-- ---------------------------------------------------------------------------
--
-- Payment details and dietary preferences only. Nothing here can change a
-- house_id, an admin flag or the `is_demo` marker itself — a function that
-- could clear `is_demo` would be a function that unlocks real accounts on the
-- second call.
--
-- **Two functions, not one, and that is deliberate.** A single
-- `demo_update_profile(payment…, dietary)` has to decide what a null argument
-- means, and it cannot mean the same thing for both. Clearing your bank details
-- is a real thing to do — `updatePaymentDetails` says "Cleared. Housemates will
-- be told you have no details set" — so nulls there must be written through.
-- But then saving *dietary* preferences would have to pass five nulls for the
-- payment columns and would wipe them. Coalescing instead breaks the clear.
-- Splitting the write in two is the only version where null is unambiguous.

-- The caller/target checks are identical in both, so they live here once.
create or replace function demo_assert_can_edit(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house  uuid;
  v_target record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select house_id into v_house from profiles where id = auth.uid();
  if v_house is null then
    raise exception 'You are not in a house';
  end if;

  select house_id, is_demo into v_target from profiles where id = p_target;
  if v_target is null or v_target.house_id is distinct from v_house then
    raise exception 'That housemate is not in your house';
  end if;
  if not v_target.is_demo then
    raise exception 'Only a demo housemate can be edited this way';
  end if;
end;
$$;

revoke all on function demo_assert_can_edit(uuid) from public;
grant execute on function demo_assert_can_edit(uuid) to authenticated;

-- Nulls are written through: clearing a field is a real edit.
create or replace function demo_update_payment_details(
  p_target         uuid,
  p_bank_name      text,
  p_sort_code      text,
  p_account_number text,
  p_payment_link   text,
  p_note           text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed integer;
begin
  perform demo_assert_can_edit(p_target);

  with updated as (
    update profiles
       set payment_bank_name      = p_bank_name,
           payment_sort_code      = p_sort_code,
           payment_account_number = p_account_number,
           payment_link           = p_payment_link,
           payment_details_text   = p_note
     where id = p_target
    returning 1
  )
  select count(*) into v_changed from updated;

  return v_changed;
end;
$$;

revoke all on function demo_update_payment_details(uuid, text, text, text, text, text) from public;
grant execute on function demo_update_payment_details(uuid, text, text, text, text, text) to authenticated;

-- An empty array is a real answer here — "no dietary requirements" — so this
-- takes `text[] not null` in spirit and coalesces only a missing argument.
create or replace function demo_update_dietary(
  p_target  uuid,
  p_dietary text[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changed integer;
begin
  perform demo_assert_can_edit(p_target);

  with updated as (
    update profiles
       set dietary_preferences = coalesce(p_dietary, '{}'::text[])
     where id = p_target
    returning 1
  )
  select count(*) into v_changed from updated;

  return v_changed;
end;
$$;

revoke all on function demo_update_dietary(uuid, text[]) from public;
grant execute on function demo_update_dietary(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Deleting a house
-- ---------------------------------------------------------------------------
--
-- `0002_rls.sql` grants select, insert and update on `houses` and **no delete**,
-- so with RLS on, nobody could remove one — which is why the last member of a
-- house hit a dead end when trying to delete their account. There was nothing
-- to offer them.
--
-- Everything hanging off the house cascades: plans (and through them meals,
-- baskets, splits), recipes, pantry, staples, expenses, leftovers.
-- `profiles.house_id` is `on delete set null`, so any surviving member is
-- detached cleanly and lands on onboarding rather than pointing at a ghost.
--
-- Demo housemates are removed outright rather than detached. They are seeded
-- placeholders with no auth account, so a demo profile with a null house_id is
-- litter: nobody can sign in as it and nothing can ever reference it again.
--
-- No `is_demo` condition on the house itself — this is a real thing a real
-- person does to their own house. Membership is the check.

create or replace function delete_house(p_house_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house   uuid;
  v_changed integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select house_id into v_house from profiles where id = auth.uid();
  if v_house is null or v_house is distinct from p_house_id then
    raise exception 'That is not your house';
  end if;

  -- Before the house, so the cascade does not detach them first.
  delete from profiles where house_id = p_house_id and is_demo;

  with deleted as (
    delete from houses where id = p_house_id returning 1
  )
  select count(*) into v_changed from deleted;

  return v_changed;
end;
$$;

revoke all on function delete_house(uuid) from public;
grant execute on function delete_house(uuid) to authenticated;
