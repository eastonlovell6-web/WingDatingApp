-- supabase/sql/008_grant_service_role_privileges.sql
-- Hand-apply in the Supabase SQL Editor (see 001_notifications_schema.sql —
-- this project has no migrations folder).
--
-- service_role bypasses RLS but still needs standard GRANT privileges on
-- each table to touch it at all — those were never set up since this
-- schema was hand-applied via the SQL Editor rather than through Supabase's
-- own provisioning. Needed by scripts/seed-test-users.mjs, which uses the
-- service role key to create fake test accounts and their data.

grant select, insert, update, delete on public.users to service_role;
grant select, insert, update, delete on public.friendships to service_role;
grant select, insert, update, delete on public.introductions to service_role;
grant select, insert, update, delete on public.intro_requests to service_role;
grant select, insert, update, delete on public.chats to service_role;
grant select, insert, update, delete on public.messages to service_role;
