-- supabase/sql/002_users_friendships_schema.sql
-- Hand-apply in the Supabase SQL Editor (see 001_notifications_schema.sql —
-- this project has no migrations folder; schema is applied by hand, one
-- script at a time, only when the current work needs it).
--
-- `users` already existed live (created ad hoc while building onboarding/
-- profile) but was never checked in, so there was no reproducible source of
-- truth for it — this captures its actual live shape (verified via
-- information_schema/pg_constraint against the linked project on 2026-07-14).
-- `friendships` did NOT exist live at all — lib/friendships.ts's
-- getMatchmakerFriends() query against it would fail in production today.
-- Both gaps are fixed here.

create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  name text,
  photos text[] default '{}',
  bio_prompts jsonb[] default '{}',
  role text check (role in ('wing-me', 'wing-somebody')),
  created_at timestamptz default now()
);

-- user_id is the friend who granted permission; friend_id is the person
-- allowed to introduce them (see lib/friendships.ts). A row's existence
-- also represents the underlying contact/friend relationship itself, since
-- there is no separate "we are friends" table yet.
create table if not exists friendships (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  can_introduce boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);

alter table users enable row level security;
alter table friendships enable row level security;

-- users already has "Users can view/insert/update their own profile" (self
-- only) applied live. Those cover writes fine, but self-only SELECT means
-- the client can never read a *friend's* name/photos/role — which breaks
-- getMatchmakerFriends(). Add a second, additive SELECT policy (permissive
-- policies OR together) scoped to the friendship graph, matching the "no
-- global profile discovery" rule: visible only if you are that user, or a
-- friendships row connects you to them in either direction.
create policy "users_select_self_or_friend" on users
  for select using (
    auth.uid() = id
    or exists (
      select 1 from friendships
      where (friendships.user_id = users.id and friendships.friend_id = auth.uid())
         or (friendships.user_id = auth.uid() and friendships.friend_id = users.id)
    )
  );

-- No write policy yet: nothing in the app creates friendships rows today
-- (the Friend Visibility Settings / contact-sync screen isn't built). Add
-- an insert/update policy here when that screen ships.
create policy "friendships_select_participant" on friendships
  for select using (auth.uid() = user_id or auth.uid() = friend_id);

-- users_select_self_or_friend alone leaves a gap: Flow 1's whole premise is
-- that user_a and user_b are usually strangers to each other (only the
-- matchmaker is guaranteed to be friends with both, since Matchmaker Step 1
-- only lets a matchmaker pick from their own friends list) — so with no
-- friendships row between them, getIncomingIntroductions/
-- getIntroductionDetail (lib/introductions.ts) silently lose the match's
-- name/photos/prompts to RLS and fall back to "Someone" with nothing to
-- show. Additive SELECT policy (permissive policies OR together): visible
-- if you and that user are both matchmaker/user_a/user_b on the same
-- introductions row, regardless of any friendships row.
create policy "users_select_intro_participant" on users
  for select using (
    exists (
      select 1 from introductions
      where users.id in (introductions.matchmaker_id, introductions.user_a_id, introductions.user_b_id)
        and auth.uid() in (introductions.matchmaker_id, introductions.user_a_id, introductions.user_b_id)
    )
  );
