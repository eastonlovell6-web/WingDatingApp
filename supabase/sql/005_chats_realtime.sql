-- supabase/sql/005_chats_realtime.sql
-- Hand-apply in the Supabase SQL Editor (see 001_notifications_schema.sql —
-- this project has no migrations folder).
--
-- Three independent fixes needed for real chat data:
--
-- 1. `chats.intro_id` gets a unique constraint. respond-to-introduction
--    inserts a chat row right after an intro is accepted; if that insert
--    is ever retried (e.g. a manual re-run after a transient failure),
--    this constraint guarantees it can never produce two chats for one
--    introduction.
--
-- 2. `messages` is added to the `supabase_realtime` publication. Without
--    this, postgres_changes subscriptions never fire, regardless of RLS.
--    RLS (messages_select_participant, already in 001) continues to scope
--    which rows each subscriber actually receives.
--
-- 3. Explicit SELECT grants on `chats` and `messages` for `authenticated`.
--    Both tables were created via raw SQL in 001, not the Studio Table
--    Editor — the same gap that broke onboarding for `friendships` (see
--    004_grant_friendships_select.sql). RLS policies alone don't grant
--    table-level privileges; without this, every client read against
--    these two tables fails with "permission denied," independent of RLS.

alter table chats add constraint chats_intro_id_unique unique (intro_id);

alter publication supabase_realtime add table messages;

grant select on public.chats to authenticated;
grant select on public.messages to authenticated;
