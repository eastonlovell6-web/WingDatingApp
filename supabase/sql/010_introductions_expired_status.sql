-- supabase/sql/010_introductions_expired_status.sql
-- Hand-apply in the Supabase SQL Editor (see 001_notifications_schema.sql —
-- this project has no migrations folder).
--
-- Adds an 'expired' status value to the introductions table's check constraint.
-- A daily sweep (a separate Edge Function, not part of this file) transitions
-- stale pending intros to this status after a 7-day window anchored on
-- introductions.created_at. Expiry is silent — no push, no matchmaker visibility,
-- matching the existing silent-pass convention.

alter table introductions drop constraint introductions_status_check;

alter table introductions add constraint introductions_status_check
  check (status in ('both_pending', 'pending_a', 'pending_b', 'accepted', 'passed', 'withdrawn', 'expired'));
