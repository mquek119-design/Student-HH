-- Demo housemates need payment details.
--
-- `profiles_update` is `using (id = auth.uid())`, so nobody can write another
-- person's row — correct, and it means the seeder cannot give demo housemates
-- bank details. Without them, rotating the collector to a demo housemate shows
-- "they haven't added payment details yet" and the settle-up flow cannot be
-- walked through at all.
--
-- So the detail-setting moves inside the SECURITY DEFINER function that already
-- creates them, which is the same pattern and the same blast radius: it can
-- only touch demo rows, and only in the caller's own house.
--
-- The digits below are the Bank of England's published test sort code (04-00-04
-- is Monzo's real sort code but the account number is not a real account) and
-- exist purely so the copy buttons have something to copy.

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
  v_banks    text[] := array['Monzo', 'Starling', 'Revolut', 'Barclays'];
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

    insert into profiles (
      id, name, email, house_id, accent, is_demo,
      payment_bank_name, payment_sort_code, payment_account_number, payment_link
    )
    values (
      gen_random_uuid(),
      v_name,
      lower(v_name) || '.demo@housegrocer.local',
      v_house_id,
      v_accents[1 + (v_index % array_length(v_accents, 1))],
      true,
      v_banks[1 + (v_index % array_length(v_banks, 1))],
      '04-00-04',
      lpad((12345670 + v_index)::text, 8, '0'),
      'monzo.me/' || lower(v_name)
    );
    v_created := v_created + 1;
  end loop;

  return v_created;
end;
$$;

revoke all on function seed_demo_housemates(text[]) from public;
grant execute on function seed_demo_housemates(text[]) to authenticated;
