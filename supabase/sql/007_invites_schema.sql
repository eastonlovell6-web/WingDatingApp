-- supabase/sql/007_invites_schema.sql
-- Hand-apply in the Supabase SQL Editor (see 001_notifications_schema.sql —
-- this project has no migrations folder; schema is applied by hand, one
-- script at a time, only when the current work needs it).
--
-- Backs the Home screen's Invite page. Each user gets 5 rows, lazily
-- seeded client-side by lib/invites.ts's getInviteSlots on first visit.
-- `status` only tracks whether the app has fired the native share sheet
-- for that code — onboarding does NOT check invite codes at signup, so
-- there is no real redemption to track yet (see
-- docs/superpowers/specs/2026-07-16-invite-page-design.md).

create table invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  status text not null default 'unsent' check (status in ('unsent', 'sent')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table invites enable row level security;

create policy "invites_select_own" on invites for select using (auth.uid() = owner_id);
create policy "invites_insert_own" on invites for insert with check (auth.uid() = owner_id);
create policy "invites_update_own" on invites for update using (auth.uid() = owner_id);
