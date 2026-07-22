-- supabase/sql/010_introductions_expired_status.sql
-- Hand-apply in the Supabase SQL Editor (see 001_notifications_schema.sql —
-- this project has no migrations folder).
--
-- Adds an 'expired' status so intros that have been pending too long
-- (exceeding the ttl_hours threshold) can be automatically transitioned
-- to a resolved state without requiring either participant to explicitly pass.
-- Expired intros are excluded from the incoming-intros feed, freeing up slots
-- and signaling to users that the intro opportunity has closed.

alter table introductions drop constraint introductions_status_check;

alter table introductions add constraint introductions_status_check
  check (status in ('both_pending', 'pending_a', 'pending_b', 'accepted', 'passed', 'withdrawn', 'expired'));
