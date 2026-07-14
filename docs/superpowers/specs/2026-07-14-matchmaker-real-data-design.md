# Matchmaker Step 1+2 — Wire to Real Data

## Context

`components/matchmaker/select.tsx` (Step 1) and `app/matchmaker/note.tsx` (Step 2)
currently run entirely on `MOCK_MATCHMAKER_FRIENDS` and a local Zustand store
(`store/intros.ts`). The real backend already exists: a `friendships` table
(`user_id, friend_id, can_introduce`), an `introductions` table, and a working
`send-introduction` Supabase Edge Function (`lib/introductions.ts`'s
`sendIntroduction()`) that inserts the row, re-checks the 3-pending cap
server-side, and pushes to both real recipients. This task wires the two
screens to that real data instead of the mocks.

## Scope boundary

Touches only:
- `lib/friendships.ts` (new)
- `components/matchmaker/select.tsx`
- `app/matchmaker/note.tsx`

Explicitly **out of scope**, left on mock data:
- `app/(tabs)/index.tsx` (Home) — still calls `getIntroducibleFriends()` from
  the mock module for its `introducibleCount` prop. Home-feed wiring is a
  separate, already-deferred task.
- `app/matchmaker/prompt-friends.tsx` — still calls `getIntroducibleFriends()`.
  It routes into `select.tsx` via `?preselect=<mockId>`; once `select.tsx`
  reads real UUIDs, a mock preselect id will no longer match any real friend.
  This is not a crash — `select.tsx`'s existing fallback already treats an
  unrecognized preselect id as "no selection" — it's a known, accepted gap
  until Home-feed wiring touches this file too.
- `components/matchmaker/mockMatchmakerFriends.ts` — the pure helpers
  (`getFriendEligibility`, `getIneligibleCaption`, the `FriendEligibility` and
  `MatchmakerFriend` types) stay and keep being imported from here (Home and
  `FriendPickerChip` still depend on them). Only `MOCK_MATCHMAKER_FRIENDS` and
  `getIntroducibleFriends` are superseded — for the two files in scope, not
  deleted, since Home still needs them.

**Known gap, accepted as-is:** there is no friendship-creation flow in the app
yet (no contacts sync, no invite redemption — confirmed via
`app/(auth)/onboarding.tsx`'s `MOCK_FRIENDS` placeholder). Every real account's
`friendships` table will be empty until that separate subsystem exists.
Testing this task requires hand-inserting `friendships` (and `introductions`,
for cap-testing) rows via the Supabase SQL Editor for test accounts, matching
this project's existing "create tables/rows by hand as needed" convention.

## Data layer — `lib/friendships.ts`

New file, following the flat-query style already used in `lib/supabase.ts`
(no PostgREST embed/join syntax, to avoid guessing at FK constraint names).

```ts
export async function getMatchmakerFriends(userId: string): Promise<MatchmakerFriend[]>
```

Implementation, three sequential queries:

1. `friendships` where `friend_id = userId` → `{ user_id, can_introduce }[]`.
   Row semantics (confirmed): a row's `user_id` is the friend who has granted
   permission, `friend_id` is the person allowed to introduce them. So "my
   friend list with their can_introduce setting toward me" = rows where
   `friend_id = <me>`.
2. `users` where `id in (friendIds from step 1)` → `{ id, name, photos, role }[]`.
3. `introductions` where `status in ("pending_a","pending_b","both_pending")`
   and (`user_a_id in (friendIds)` or `user_b_id in (friendIds)`) →
   aggregate an active-pending count per friend id client-side (mirrors the
   same active-status set the edge function itself checks).

Merge into `MatchmakerFriend[]`:
- `imageUri = photos?.[0]`
- `canIntroduce` = from the friendships row
- `activePendingCount` = the aggregated count from step 3 (0 if none)
- `lookingToGetSetUp = role !== "wing-somebody"` — same derivation already
  used for `isWingman` in `app/(tabs)/index.tsx`, so a user who hasn't set a
  role, or is "wing-me", defaults to eligible; only explicit "wing-somebody"
  opts a friend out.

If `friendIds` is empty after step 1, short-circuit and return `[]` (skip
steps 2/3).

## `select.tsx` changes

- Replace the `MOCK_MATCHMAKER_FRIENDS` import with:
  ```ts
  const userId = useAuthStore((s) => s.user?.id);
  const { data: friends = [], isLoading } = useQuery({
    queryKey: ["matchmakerFriends", userId],
    queryFn: () => getMatchmakerFriends(userId!),
    enabled: !!userId,
  });
  ```
  (Same shape as the existing `userProfile` query in `app/(tabs)/index.tsx`.)
- Add a loading state (spinner, centered, replacing the friend grid while
  `isLoading`) and an empty state for `friends.length === 0` (distinct from
  the existing `MatchmakerEncouragementState`, which is for "1 eligible
  friend" — an empty real account needs its own "no friends yet" message).
- Move `preselect` handling out of the `useState` initializer (can no longer
  run synchronously against async data) into a `useEffect` keyed on
  `friends`, applying the same eligibility check as today.
- All other logic (`eligibleCount`, `filteredFriends`, `handleToggle`,
  `handleContinue`) becomes derived from `friends` instead of
  `MOCK_MATCHMAKER_FRIENDS`; unchanged otherwise.

## `note.tsx` changes

- Read `friendA`/`friendB` from the same query key/cache instead of
  `MOCK_MATCHMAKER_FRIENDS.find(...)`:
  ```ts
  const { data: friends = [] } = useQuery({
    queryKey: ["matchmakerFriends", userId],
    queryFn: () => getMatchmakerFriends(userId!),
    enabled: !!userId,
  });
  const friendA = friends.find((f) => f.id === friendAId);
  const friendB = friends.find((f) => f.id === friendBId);
  ```
  This is a cache hit from Step 1's navigation in the normal flow — no extra
  network round trip.
- Remove the local self-notification block entirely: the
  `Notifications.getPermissionsAsync` / `requestPermissionsAsync` /
  `scheduleNotificationAsync` call, and its now-unused imports
  (`expo-notifications`, `formatIntroNotification`, `MOCK_PROFILE_USER`). The
  edge function (`send-introduction`) already pushes to both real recipients
  server-side — this client-side call was a pre-push placeholder that now
  notifies the wrong person (the sender, about their own action) and
  duplicates the real push.
- Replace the local-only send with a real, **awaited** call:
  ```ts
  async function handleSend() {
    if (confirming || sending || !friendA || !friendB || !canSend) return;
    setSending(true);
    setSendError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await sendIntroduction(friendA.id, friendB.id, note.trim());
      useIntrosStore.getState().sendIntro(friendA, friendB, note.trim());
      setConfirming(true);
    } catch (err) {
      setSendError(
        err instanceof Error ? err.message : "Couldn't send that intro. Try again."
      );
    } finally {
      setSending(false);
    }
  }
  ```
  - The `useIntrosStore` append is kept as a deliberate, temporary bridge —
    the Intros tab (sent-history list) is still mock-backed and out of scope
    for this task; this preserves its existing "just-sent intro shows up"
    continuity until that tab gets its own real-data task.
  - On failure (most notably the server's 3-pending-cap 429, whose message is
    already user-readable: *"One of these people already has the maximum of
    3 pending intros"*), show `sendError` inline below the Send button (same
    inline-text-error convention as `app/(auth)/index.tsx` and `verify.tsx`)
    and leave the screen in place with Send re-enabled, rather than
    proceeding to the confirmation overlay. Silently showing "Your intro is
    on its way" after a real failure would violate the anti-spam cap being a
    listed non-negotiable — the enforcement has to be visible when it fires.
  - Button's `disabled` prop becomes `!canSend || confirming || sending`.

## Testing plan

1. In the Supabase SQL Editor, for two test accounts A and B (and a third,
   C, to pick as the intro target), insert `friendships` rows so A's
   matchmaker screen sees B and C as eligible friends (`friend_id = A`,
   `user_id = B`/`C`, `can_introduce = true`).
2. Run Step 1 → Step 2 → Send on a real device/simulator logged in as A;
   confirm a real `introductions` row is created with `status = both_pending`
   and B/C each receive a real push (already covered by the merged push
   notifications feature).
3. Insert 3 pre-existing active-status `introductions` rows for B, then
   attempt to send a new intro involving B; confirm the inline cap error
   surfaces instead of the confirmation overlay.
4. Confirm an account with zero `friendships` rows sees the new empty state,
   not a crash or an infinite spinner.
