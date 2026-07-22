# Waiting on Them — Design Spec

## Problem

Two gaps found reviewing the accept flow:

1. `supabase/functions/respond-to-introduction/index.ts:112-120` only pushes
   the matchmaker (`formatIntroAcceptedNotification`) once an introduction
   reaches `accepted`. Neither matched participant gets a push telling them
   the chat is live — they'd only find out by opening the Chats tab, where
   realtime `subscribeToInbox` (`lib/chat.ts`) surfaces it if the app happens
   to be open.
2. `app/intro/[id].tsx:115-131`'s `handleAccept` plays a haptic + scale
   animation then navigates back to Home — no confirmation copy, and no
   persistent way to tell "I already accepted this, still waiting" from "I
   haven't looked at this yet."

## Scope

In scope:
- New `expired` status on `introductions`, auto-applied by a daily scheduled
  check to any `both_pending`/`pending_a`/`pending_b` row older than 7 days
  from `created_at`. Expiry is silent — no push to anyone, matching the
  existing silent-pass convention noted in
  `003_introductions_withdrawn_status.sql`.
- New "Waiting on them" section on the Home feed
  (`app/(tabs)/index.tsx`), below the existing `IntroFeed`: introductions
  where the current user already accepted and the other participant hasn't
  responded yet (and the intro hasn't expired).
- `respond-to-introduction` also pushes both `user_a_id` and `user_b_id`
  when the second acceptance lands, alongside the existing matchmaker push.
- Reuse `SendConfirmationOverlay` (already generic via its `message` prop)
  to show a brief confirmation after a successful accept in
  `app/intro/[id].tsx`, before navigating back to Home.

Out of scope:
- Any change to passed/withdrawn/silent-rejection behavior — untouched.
- Matchmaker-side visibility into expiry — the firewall stays intact.
  `getSentIntroductions`/`getMatchmakerStats` already collapse everything
  that isn't `accepted` into "pending"; `expired` falls into that same
  bucket with no code change (see Data Model note below).
- A separate `accepted_at` timestamp. "Waiting X days" copy is computed
  from the existing `created_at` — the same anchor the 7-day expiry clock
  uses. Slightly imprecise for whichever participant accepted second, but
  not worth a new column for.
- Snooze (`handleSnooze`, `app/intro/[id].tsx:109`) — already a known
  no-op/TODO, untouched here.

## Data Model

New file: `supabase/sql/010_introductions_expired_status.sql`
```sql
alter table introductions drop constraint introductions_status_check;
alter table introductions add constraint introductions_status_check
  check (status in ('both_pending', 'pending_a', 'pending_b', 'accepted',
                     'passed', 'withdrawn', 'expired'));
```
Constraint name assumed from the `_check` suffix pattern in
`003_introductions_withdrawn_status.sql` — confirm the actual name (`\d
introductions` in the SQL editor) before running, since a mismatch just
errors harmlessly on `drop constraint` rather than corrupting anything.

**Expiry job:** new Edge Function `supabase/functions/expire-introductions/index.ts`,
invoked on a daily Supabase Cron schedule (Dashboard → Database → Cron, or
`supabase/config.toml`'s `[functions.expire-introductions]` schedule block).
This is the first scheduled job in the codebase — no existing cron infra to
extend, so this also establishes the pattern for any future one.

```ts
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const { error } = await admin
  .from("introductions")
  .update({ status: "expired" })
  .in("status", ["both_pending", "pending_a", "pending_b"])
  .lt("created_at", sevenDaysAgo);
```
No push, no meaningful response payload — runs unattended, logs via
`console.warn` on error same as every other function here.

Because `send-introduction/index.ts:26`'s `activeStatuses` array
(`["both_pending", "pending_a", "pending_b"]`) already excludes anything
outside that list when counting a user's active pending intros, an expired
row automatically frees both participants' anti-spam slot — no change
needed to that logic.

## `lib/introductions.ts` additions

New `getWaitingOnThemIntroductions(userId)`, mirroring
`fetchIncomingIntroRows`/`getIncomingIntroductions`'s existing
two-query-then-join-users shape, with the complementary status filters
(recall: `pending_b` means user_a already accepted and user_b is the one
still pending, and vice versa for `pending_a`):

```ts
async function fetchWaitingOnThemRows(userId: string) {
  const [asA, asB] = await Promise.all([
    supabase.from("introductions")
      .select("id, matchmaker_id, user_b_id, created_at")
      .eq("user_a_id", userId).eq("status", "pending_b"),
    supabase.from("introductions")
      .select("id, matchmaker_id, user_a_id, created_at")
      .eq("user_b_id", userId).eq("status", "pending_a"),
  ]);
  if (asA.error) throw asA.error;
  if (asB.error) throw asB.error;
  return [
    ...(asA.data ?? []).map((row) => ({ ...row, otherUserId: row.user_b_id })),
    ...(asB.data ?? []).map((row) => ({ ...row, otherUserId: row.user_a_id })),
  ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}
```
`getWaitingOnThemIntroductions` then joins `users` the same way
`getIncomingIntroductions` does, returning a `WaitingIntro` shape — same
fields as `IntroPreview` minus `note` (not shown on a waiting card), plus
`created_at` for the "waiting X days" label.

## Component: `components/intro/WaitingIntroCard.tsx` (new)

A flattened, non-interactive variant of `IntroPreviewCard` — same
avatar/name/mutual-friend layout and PENDING butter badge, but no
Accept/Skip buttons, and a muted "Waiting on {name}" line with a relative
day count derived from `created_at`. No new design tokens — reuses existing
card/badge primitives.

## Home wiring — `app/(tabs)/index.tsx`

```tsx
const { data: waitingOn } = useQuery({
  queryKey: ["waitingOnThemIntros", userId],
  queryFn: () => getWaitingOnThemIntroductions(userId!),
  enabled: !!userId,
});
```
Rendered as a new section below the existing `IntroFeed`/`PromptCard`
branch, in both the wingman and non-wingman render paths — a wingman-only
user can still have accepted an intro before or after switching roles, so
this isn't gated on `isWingman`. Renders nothing when `waitingOn` is empty
— no placeholder card, consistent with how the rest of Home behaves.

## Push notification fix — `respond-to-introduction/index.ts`

At lines 112-120, alongside the existing matchmaker push, add pushes to
both participants. Needs the matchmaker's first name, which this function
doesn't currently select — fetch it the same way
`nudge-introduction/index.ts:42-47` does.

New copy in `notificationCopy.ts`:
```ts
export function formatIntroMatchedNotification(matchmakerFirstName: string) {
  return {
    title: "You're in!",
    body: `${matchmakerFirstName} introduced you two, and you're both in — say hi`,
  };
}
```
Updated push block (still best-effort, still inside the existing try/catch
so a push failure never turns a committed status update into a failure
response):
```ts
try {
  await Promise.all([
    sendPushToUser(admin, intro.matchmaker_id, title, body, { type: "intro_accepted" }),
    sendPushToUser(admin, intro.user_a_id, matchedTitle, matchedBody, { type: "intro_matched", introId }),
    sendPushToUser(admin, intro.user_b_id, matchedTitle, matchedBody, { type: "intro_matched", introId }),
  ]);
} catch (pushError) {
  console.warn("respond-to-introduction: push delivery failed", pushError);
}
```

## Accept confirmation — `app/intro/[id].tsx`

Reuse `SendConfirmationOverlay` as-is (already generic despite its
matchmaker-flow name/location — takes `visible`, `onDismiss`, and an
optional `message` override). In `handleAccept` (lines 115-131), show it
with `message="You're in — we'll let you know if they say yes too"` right
after the haptic/scale animation, moving `router.back()` into its
`onDismiss` (fires 1.5s later) instead of the current 180ms `setTimeout`.

## Error Handling

- `expire-introductions` runs unattended; a failed sweep just means that
  day's pass doesn't run — no user-facing error path, same
  `console.warn`/function-logs convention as the rest of the codebase.
- The two new participant pushes reuse the exact best-effort try/catch
  already wrapping the matchmaker push — one failing (e.g. no
  `push_tokens` row for that user) doesn't block the others or the
  response.
- `getWaitingOnThemIntroductions` throws on Supabase errors, matching every
  other `lib/introductions.ts` function's convention.

## Testing

- Manual: accept an intro as user A on a test account, confirm the
  confirmation overlay copy shows and Home now lists it under "Waiting on
  them"; accept as user B from a second test account, confirm both accounts
  get the new "you're in" push, the item disappears from both accounts'
  "Waiting on them" lists, and the match shows up in Chats.
- Manual: backdate a test row's `created_at` past 7 days, invoke
  `expire-introductions` directly, confirm status flips to `expired` and
  the row drops out of `getIncomingIntroductions` and
  `getWaitingOnThemIntroductions` for both participants, with no push
  fired.
- Manual: confirm a passed intro (from either side) never appears in
  "Waiting on them" — only the status complementary to the acceptor
  (`pending_a`/`pending_b`) should ever show there.
