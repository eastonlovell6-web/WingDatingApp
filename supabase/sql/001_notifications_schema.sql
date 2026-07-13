-- supabase/sql/001_notifications_schema.sql
-- Hand-apply in the Supabase SQL Editor (this project has no migrations
-- folder — see project memory: schema is applied by hand, one script at a
-- time, only when the current work needs it).

create extension if not exists pgcrypto;

create table if not exists introductions (
  id uuid primary key default gen_random_uuid(),
  matchmaker_id uuid not null references auth.users(id),
  user_a_id uuid not null references auth.users(id),
  user_b_id uuid not null references auth.users(id),
  note text not null,
  status text not null default 'both_pending'
    check (status in ('both_pending', 'pending_a', 'pending_b', 'accepted', 'passed')),
  created_at timestamptz not null default now()
);

create table if not exists intro_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id),
  target_id uuid not null references auth.users(id),
  mutual_friend_id uuid not null references auth.users(id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now()
);

create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  intro_id uuid not null references introductions(id),
  created_at timestamptz not null default now()
);

-- No read_at column — ever. Wing has no read receipts anywhere.
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats(id),
  sender_id uuid not null references auth.users(id),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists push_tokens (
  user_id uuid primary key references auth.users(id),
  expo_push_token text not null,
  updated_at timestamptz not null default now()
);

alter table introductions enable row level security;
alter table intro_requests enable row level security;
alter table chats enable row level security;
alter table messages enable row level security;
alter table push_tokens enable row level security;

-- Read-only for participants. No insert/update policy on these four tables:
-- every write goes through the service-role Edge Functions (Tasks 3-6),
-- which are the only place the accept/pass state machine and the
-- matchmaker firewall are enforced.
create policy "introductions_select_participant" on introductions
  for select using (
    auth.uid() = matchmaker_id or auth.uid() = user_a_id or auth.uid() = user_b_id
  );

create policy "intro_requests_select_participant" on intro_requests
  for select using (
    auth.uid() = requester_id or auth.uid() = mutual_friend_id
  );

create policy "chats_select_participant" on chats
  for select using (
    exists (
      select 1 from introductions
      where introductions.id = chats.intro_id
        and (auth.uid() = introductions.user_a_id or auth.uid() = introductions.user_b_id)
    )
  );

create policy "messages_select_participant" on messages
  for select using (
    exists (
      select 1 from chats
      join introductions on introductions.id = chats.intro_id
      where chats.id = messages.chat_id
        and (auth.uid() = introductions.user_a_id or auth.uid() = introductions.user_b_id)
    )
  );

-- push_tokens is the one table a client writes directly — a user
-- registering their own device for push.
create policy "push_tokens_owner" on push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
