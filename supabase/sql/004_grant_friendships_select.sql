-- supabase/sql/004_grant_friendships_select.sql
-- Hand-apply in the Supabase SQL Editor (see 001_notifications_schema.sql —
-- this project has no migrations folder).
--
-- `friendships` (002_users_friendships_schema.sql) was created via a raw SQL
-- script, which only adds RLS *policies* — it does not auto-grant base table
-- privileges to `anon`/`authenticated` the way the Studio Table Editor does.
-- `users`' RLS policy "users_select_self_or_friend" runs an EXISTS subquery
-- against `friendships`, so evaluating that policy (e.g. on the RETURNING
-- row of an upsert to `users`, as onboarding's name step does) needs
-- `authenticated` to have SELECT on `friendships` too, or Postgres throws
-- "permission denied for table friendships" — which is what broke the
-- onboarding "What should we call you?" Continue button.

grant select on public.friendships to authenticated;
