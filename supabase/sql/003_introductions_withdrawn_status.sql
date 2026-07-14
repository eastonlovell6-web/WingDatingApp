-- supabase/sql/003_introductions_withdrawn_status.sql
-- Hand-apply in the Supabase SQL Editor (see 001_notifications_schema.sql —
-- this project has no migrations folder).
--
-- Adds a terminal 'withdrawn' status so a matchmaker can cancel their own
-- still-pending sent intro (SentIntroRow's "Withdraw" action). Distinct
-- from 'passed': that's a silent recipient decline the matchmaker firewall
-- must never reveal, whereas withdrawn is the matchmaker's own action on
-- their own intro, so it's fine for them to see it disappear from their
-- sent list. Excluded from lib/friendships.ts's ACTIVE_INTRO_STATUSES and
-- send-introduction's activeStatuses (neither lists it), so a withdrawn
-- intro immediately frees up both participants' pending-intro slots.

alter table introductions drop constraint introductions_status_check;

alter table introductions add constraint introductions_status_check
  check (status in ('both_pending', 'pending_a', 'pending_b', 'accepted', 'passed', 'withdrawn'));
