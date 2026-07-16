# Invite Page — Design Spec

## Problem

The Home screen's Invite button (`components/home/HomeHeader.tsx`) and the
Home feed's empty-intros Invite button (`components/home/EmptyIntrosState.tsx`,
rendered via `IntroFeed`) both already accept an `onInvitePress` prop, but
`app/(tabs)/index.tsx` never passes one — tapping either button today does
nothing. CLAUDE.md's Launch Context specifies the app is invite-only with 5
invite tokens per user, but no `invites` table or invite UI exists yet.

## Scope

In scope:
- A dedicated Invite page reachable from the Home screen
- Generating and persisting 5 invite codes per user
- Sharing a code via the native share sheet
- Tracking which of a user's 5 codes have been shared ("sent" vs "unsent")

Out of scope (explicitly deferred):
- Gating signup/onboarding on a valid invite code — onboarding stays open.
  Because of this, "sent" only means *this app fired the share sheet for
  that code*, not that anyone redeemed it.
- Wiring `matchmaker/select.tsx`'s own separate Invite stub (its own TODO,
  different screen — not "the home page").

## Data Model

New file: `supabase/sql/007_invites_schema.sql`

```sql
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
```

Each user gets exactly 5 rows, lazily seeded client-side the first time they
open the Invite page: if `getInviteSlots` finds 0 rows for the user, it
generates 5 unique codes and inserts them before returning.

## `lib/invites.ts` (new file)

Follows the conventions in `lib/friendships.ts` (plain async functions over
`supabase`, throw on error, no admin client needed since a user only ever
reads/writes their own rows).

- `getInviteSlots(userId: string): Promise<InviteSlot[]>` — selects the
  user's invite rows ordered by `created_at`; if empty, generates 5 short
  random codes (e.g. `WING-X7K2`, uppercase alphanumeric), inserts them,
  retrying generation on a unique-constraint collision (23505), then
  re-selects and returns.
- `markInviteSent(inviteId: string): Promise<void>` — updates one row's
  `status` to `'sent'` and sets `sent_at = now()`.

```ts
interface InviteSlot {
  id: string;
  code: string;
  status: "unsent" | "sent";
}
```

## Screen: `app/(tabs)/invite.tsx`

Registered with `options={{ href: null }}` in `(tabs)/_layout.tsx` — same
pattern as `discover.tsx`: a full-screen push, not a tab bar item, reached
via `router.push("/invite")`.

Layout (cream background, matches `discover.tsx`'s header conventions):
- Header row: back chevron (`router.back()`) + "Invite Friends" title
- Subhead: "You have **{remaining} of 5** invites left" (DM Sans, ink-500),
  swapping to a celebratory "All invites sent" copy when remaining is 0
- List of 5 `InviteCodeRow` components, one per invite slot

## Component: `components/invite/InviteCodeRow.tsx` (new file)

Props: `{ code: string; status: "unsent" | "sent"; onShare: () => void }`

- Code rendered in DM Mono
- `unsent`: coral "Share" `Button` (outline or primary per design system)
- `sent`: muted "Sent" badge, non-interactive — visually parallel to
  `SentIntroRow`'s pending/matched split

Tapping Share:
1. Calls React Native's built-in `Share.share({ message: "Join me on Wing — use my invite code: {code}" })`
   — no new dependency, `expo-sharing` is for view-shot images and isn't the
   right tool for a plain text share here.
2. If the share completes with action `Share.sharedAction` (not
   `dismissedAction`), calls `markInviteSent(inviteId)` and optimistically
   flips that row to `sent` in local state / React Query cache.
3. A dismissed/cancelled share sheet is not an error — no-op.

## Wiring — `app/(tabs)/index.tsx`

Both Home-screen Invite entry points get the same handler:

```tsx
<HomeHeader ... onInvitePress={() => router.push("/invite")} />
<IntroFeed intros={intros ?? []} onInvitePress={() => router.push("/invite")} />
```

## Error Handling

- `getInviteSlots` / `markInviteSent` throw on Supabase errors, matching
  every other `lib/*.ts` file's convention — no new error-handling pattern
  introduced.
- `Share.share()` rejecting (rare, platform-level) surfaces as a thrown
  error the same way; being dismissed by the user is normal flow, not an
  error.

## Testing

- Manual verification: open Home, tap Invite (both entry points), confirm
  the Invite page loads 5 codes, sharing one fires the OS share sheet and
  flips it to "Sent", remaining count decrements, and the state persists
  across a screen revisit (backed by the `invites` table, not local-only
  state).
