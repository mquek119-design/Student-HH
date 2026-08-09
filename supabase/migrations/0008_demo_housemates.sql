-- Demo housemates for testing the split, without weakening the schema.
--
-- REPLACES an earlier attempt that did `ALTER TABLE profiles DROP CONSTRAINT
-- profiles_id_fkey`. That was the wrong fix twice over:
--
--   * The blocker was never the foreign key. It is RLS — `profiles_insert` is
--     `with check (id = auth.uid())`, so a row with any other id is refused
--     whatever the FK says. Dropping it changed nothing and the seeder still
--     failed (silently, because the error was only logged).
--   * It also removed `on delete cascade`, so deleting an auth user would
--     orphan their profile permanently.
--
-- Instead: one SECURITY DEFINER function, the same pattern as create_house().
-- It runs as owner so it can bypass RLS, but only to do this exact thing, and
-- only for the caller's own house.
--
-- Demo housemates get a NULL id in auth.users terms — they deliberately cannot
-- sign in. They exist to make splits and allocations demonstrable with more
-- than one person. `is_demo` marks them so they can be told apart from real
-- housemates and cleaned up in one go.

alter table profiles
  add column if not exists is_demo boolean not null default false;

comment on column profiles.is_demo is
  'True for seeded placeholder housemates. They have no auth.users row and cannot sign in.';

-- The FK to auth.users must tolerate demo rows, but real profiles must still
-- cascade on user deletion. Postgres cannot express "conditional FK", so the
-- constraint is dropped and the invariant is enforced by trigger instead:
-- a non-demo profile must correspond to a real auth user.
alter table profiles drop constraint if exists profiles_id_fkey;

create or replace function enforce_real_profiles_have_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not new.is_demo and not exists (select 1 from auth.users where id = new.id) then
    raise exception 'profiles.id % has no auth.users row and is not marked is_demo', new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_require_auth_user on profiles;
create trigger profiles_require_auth_user
  before insert or update on profiles
  for each row execute function enforce_real_profiles_have_users();

-- Deleting an auth user used to cascade. Reproduce that explicitly.
create or replace function delete_profile_for_deleted_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profiles where id = old.id;
  return old;
end;
$$;

do $$
begin
  create trigger on_auth_user_deleted
    after delete on auth.users
    for each row execute function delete_profile_for_deleted_user();
exception
  when insufficient_privilege or others then
    raise notice
      'Skipped on_auth_user_deleted trigger (%). Deleted users will leave an orphan profile row; clean up manually if it matters.',
      sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- Seeding entry point
-- ---------------------------------------------------------------------------

/**
 * Adds demo housemates to the caller's house. Idempotent by name.
 * Returns how many were created.
 */
create or replace function seed_demo_housemates(p_names text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_name     text;
  v_accents  avatar_accent[] := array['orange', 'green', 'purple', 'blue']::avatar_accent[];
  v_index    integer := 0;
  v_created  integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select house_id into v_house_id from profiles where id = auth.uid();
  if v_house_id is null then
    raise exception 'Join or create a house first';
  end if;

  foreach v_name in array p_names loop
    v_index := v_index + 1;

    if exists (
      select 1 from profiles
      where house_id = v_house_id and is_demo and lower(name) = lower(v_name)
    ) then
      continue;
    end if;

    insert into profiles (id, name, email, house_id, accent, is_demo)
    values (
      gen_random_uuid(),
      v_name,
      lower(v_name) || '.demo@housegrocer.local',
      v_house_id,
      v_accents[1 + (v_index % array_length(v_accents, 1))],
      true
    );
    v_created := v_created + 1;
  end loop;

  return v_created;
end;
$$;

revoke all on function seed_demo_housemates(text[]) from public;
grant execute on function seed_demo_housemates(text[]) to authenticated;

/** Removes every demo housemate from the caller's house. */
create or replace function remove_demo_housemates()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house_id uuid;
  v_removed  integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select house_id into v_house_id from profiles where id = auth.uid();
  if v_house_id is null then return 0; end if;

  with deleted as (
    delete from profiles where house_id = v_house_id and is_demo returning 1
  )
  select count(*) into v_removed from deleted;

  return v_removed;
end;
$$;

revoke all on function remove_demo_housemates() from public;
grant execute on function remove_demo_housemates() to authenticated;
