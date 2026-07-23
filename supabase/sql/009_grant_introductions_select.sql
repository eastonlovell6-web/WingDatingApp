-- supabase/sql/009_grant_introductions_select.sql
-- Hand-apply in the Supabase SQL Editor (see 001_notifications_schema.sql —
-- this project has no migrations folder).
--
-- `introductions` (001_notifications_schema.sql) was created via a raw SQL
-- script, which only adds RLS *policies* — it does not auto-grant base table
-- privileges to `anon`/`authenticated` the way the Studio Table Editor does.
-- `users`' RLS policy "users_select_intro_participant"
-- (002_users_friendships_schema.sql) runs an EXISTS subquery against
-- `introductions`, so evaluating that policy (e.g. on the RETURNING row of
-- an upsert to `users`, as onboarding's name step does) needs
-- `authenticated` to have SELECT on `introductions` too, or Postgres throws
-- "permission denied for table introductions" — which is what broke the
-- onboarding "What should we call you?" Continue button. Same root cause
-- already hit and fixed for `friendships` in 004_grant_friendships_select.sql.

grant select on public.introductions to authenticated;
