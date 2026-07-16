-- supabase/sql/006_friendships_update_policy.sql
-- Hand-apply in the Supabase SQL Editor (see 001_notifications_schema.sql —
-- this project has no migrations folder).
--
-- friendships had no UPDATE policy — 002_users_friendships_schema.sql
-- flagged this as a known gap ("Add an insert/update policy here when that
-- screen ships"). The Friend Visibility Settings screen needs to let a user
-- toggle can_introduce on their own friendships rows.
--
-- Also grants UPDATE on the base table: 004_grant_friendships_select.sql
-- already hit this same gap for SELECT (raw SQL table creation doesn't
-- auto-grant base privileges to `authenticated` the way the Studio Table
-- Editor does) — without this grant, Postgres throws "permission denied for
-- table friendships" on any UPDATE attempt regardless of the RLS policy
-- below, since the base grant is checked before RLS policies apply.
grant update on public.friendships to authenticated;

-- Same trust model as `users`' self-update policy: no column-level lock,
-- the client is trusted to only ever write can_introduce. auth.uid() =
-- user_id in both `using` and `with check` means a user can only update
-- rows where they are the granting party (see lib/friendships.ts's
-- direction convention comment on getMatchmakerFriends), and can't
-- reassign user_id/friend_id to someone else's identity.
create policy "friendships_update_own" on friendships
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
