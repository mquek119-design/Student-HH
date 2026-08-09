-- DESTRUCTIVE. Drops every HouseGrocer object in `public`, then you re-run
-- 0001_initial_schema.sql and 0002_rls.sql from scratch.
--
-- Only for development. This deletes all house data. It does NOT touch
-- auth.users, so your sign-ins survive — but their profiles are recreated by
-- the app on next load.
--
-- Run this only if a re-run of 0001 fails with "already exists" errors, which
-- means an earlier attempt landed partially.

drop table if exists delivery_receipts cascade;
drop table if exists substitutions      cascade;
drop table if exists pantry_items       cascade;
drop table if exists splits             cascade;
drop table if exists basket_allocations cascade;
drop table if exists basket_items       cascade;
drop table if exists meal_participants  cascade;
drop table if exists planned_meals      cascade;
drop table if exists weekly_plans       cascade;
drop table if exists recipe_ingredients cascade;
drop table if exists recipes            cascade;
drop table if exists ingredients        cascade;
drop table if exists profiles           cascade;
drop table if exists houses             cascade;

drop function if exists join_house(text)                          cascade;
drop function if exists create_house(text, weekday, weekday, time) cascade;
drop function if exists current_house_id()                        cascade;
drop function if exists is_house_admin()                          cascade;
drop function if exists plan_house_id(uuid)                       cascade;
drop function if exists planned_meal_house_id(uuid)               cascade;
drop function if exists basket_item_house_id(uuid)                cascade;
drop function if exists recipe_is_visible(uuid)                   cascade;
drop function if exists generate_invite_code()                    cascade;

-- The trigger may not exist: creating it needs ownership of auth.users, which
-- managed projects do not grant. Ignore any error here.
do $$
begin
  drop trigger if exists on_auth_user_created on auth.users;
exception when others then
  raise notice 'Could not drop trigger on auth.users (%) — safe to ignore.', sqlerrm;
end $$;

drop function if exists handle_new_user() cascade;

drop type if exists avatar_accent          cascade;
drop type if exists recipe_difficulty      cascade;
drop type if exists substitution_decision  cascade;
drop type if exists ingredient_category    cascade;
drop type if exists split_status           cascade;
drop type if exists plan_status            cascade;
drop type if exists meal_type              cascade;
drop type if exists weekday                cascade;
