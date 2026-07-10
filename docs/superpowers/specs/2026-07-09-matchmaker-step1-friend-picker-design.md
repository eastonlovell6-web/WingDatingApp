# Matchmaker Step 1: Friend Picker

## Summary

Build `/app/matchmaker/select.tsx` — the modal sheet that opens when the
center FAB is tapped. User picks exactly two eligible friends, then hands off
to Step 2 (write note + send), which is not built in this pass. This is
screen 4 of 9 in the build order; nothing else in the app changes except
wiring the FAB to actually navigate here.

## 1. Route registration (modal presentation)

`app/_layout.tsx` currently renders a bare `<Stack screenOptions={{
headerShown: false }} />` with no explicit children — every route
auto-registers from the file tree. Add one explicit child so this one route
gets modal treatment while everything else keeps auto-registering:

```tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen
    name="matchmaker/select"
    options={{ presentation: "modal", animation: "slide_from_bottom" }}
  />
</Stack>
```

The screen builds its own sheet chrome (see §2) rather than relying on native
modal styling for the rounded-top-corner / drag-handle look — same
self-built-header approach `intro/[id].tsx` already uses instead of a native
header.

**FAB wiring** — `components/home/TabBar.tsx`'s `handleFabPress` currently
has `// TODO: router.push('/matchmaker/select')`. Replace the TODO with the
actual `router.push`.

## 2. Screen chrome

`app/matchmaker/select.tsx`, full-bleed `View` on `surface.cream`:

- Drag handle: small `ink[300]` pill, centered, `spacing[2]` from top.
- Row below the handle: X button (left, `router.back()`) and "STEP 1 OF 2"
  label (right, `textStyles.eyebrow` — DM Mono caps, coral).
- Top corners rounded at `radii["2xl"]` (36px) — the sheet's outer `View`.
- Header block: Bricolage headline (`textStyles.heading` scale) that swaps
  copy based on `selectedIds.length`:
  - `0`: "Who should meet?"
  - `1`: "Nice. Who's their match?"
  - `2`: same as `1` (headline doesn't need a third variant — footer button
    communicates completion)
  - Subhead below: `textStyles.caption` — "Pick two friends you think would
    click."

## 3. Data model

`components/matchmaker/mockMatchmakerFriends.ts` — new fixture, shaped to
mirror the real `friendships`/`introductions` schema so the eligibility
computation is a straight swap to a Supabase query later (same pattern as
every other `mock*.ts` fixture in the app — `friendsMock.ts`,
`mockChats.ts`, `mockSentIntros.ts`, etc. — none of which hit Supabase yet
either):

```ts
export interface MatchmakerFriend {
  id: string;
  name: string;
  imageUri?: string;
  canIntroduce: boolean;      // friendships.can_introduce for this friend → current user
  activePendingCount: number; // count of introductions where this friend is
                               // user_a_id/user_b_id and status is pending_a/
                               // pending_b/both_pending
}
```

Eligibility is derived, not stored:

```ts
function eligibility(f: MatchmakerFriend): "eligible" | "not_opted_in" | "at_cap" {
  if (!f.canIntroduce) return "not_opted_in";
  if (f.activePendingCount >= 3) return "at_cap";
  return "eligible";
}
```

Ineligible caption maps 1:1: `not_opted_in` → "Hasn't opted in",
`at_cap` → "3 pending intros". Per-pair validation (whether this specific
duo already has an intro) is explicitly Step 2's job, not this screen's —
matches the task's eligibility note.

Fixture includes a mix: several eligible, one `canIntroduce: false`, one
with `activePendingCount: 3`, so all three chip states are exercised without
extra setup.

## 4. Components

**`components/matchmaker/FriendPickerChip.tsx`** — one avatar chip, all three
states:
- *Eligible + unselected*: full opacity, `Avatar` + first name, same
  visual language as `FriendsRow`'s `FriendAvatarButton`.
- *Eligible + selected*: coral ring (`borderWidth` + `coral[500]` border
  around the `Avatar`) + small coral checkmark badge overlapping the
  bottom-right of the avatar.
- *Ineligible*: `opacity: 0.4`, `Pressable` disabled, caption
  (`fontSize.xs`, `ink[500]`) under the name explaining why.
- Tapping a 3rd chip while 2 are already selected: no state change, plays a
  quick horizontal shake (`withSequence` of small translateX spring steps)
  and fires `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)`
  — distinct from the `Light`/`Medium` impact haptics and the `Success`
  notification haptic already used elsewhere, so "blocked" reads as its own
  feedback class.

**`components/matchmaker/FriendPickerGrid.tsx`** — `FlatList` (or wrapped
`View` with flex-wrap, matching whichever the grid needs for 4-column
layout) rendering `FriendPickerChip` per friend, `numColumns={4}`, fed the
filtered + eligibility-annotated list.

**`components/matchmaker/MatchmakerEncouragementState.tsx`** — shown instead
of the grid when fewer than 2 friends are eligible (zero or exactly one):
headline "Matchmaking takes two (of your friends)", subhead "Invite friends
to Wing so you can start setting people up.", primary `Button` "Invite
friends", quiet secondary text link "Not now". Both handlers are stubs
consistent with the rest of the app's not-yet-built destinations (e.g.
`FriendsRow.handleFriendPress`'s `// TODO: router.push(...)`,
`HomeHeader`'s unwired `onInvitePress`): `console.log` placeholder for
Invite, `router.back()` for "Not now".

## 5. Screen state + behavior

`app/matchmaker/select.tsx` owns:
- `search: string` — filters `MOCK_MATCHMAKER_FRIENDS` by name
  (case-insensitive substring), client-side, before eligibility rendering.
- `selectedIds: string[]` — max length 2. Toggling a selected chip removes
  it; toggling an eligible unselected chip adds it if `length < 2`,
  otherwise triggers the shake/blocked-haptic path in §4.

Layout: header block → `Input` (placeholder "Search friends") →
`FriendPickerGrid` (or `MatchmakerEncouragementState` if
`eligibleCount < 2`) → sticky footer `Button`.

Footer `Button`:
- `disabled={selectedIds.length !== 2}` (renders `coral[100]`, per existing
  `Button` disabled styling — no new variant needed).
- Label: generic "Continue" while `< 2` selected; once 2 are selected,
  `` `Continue with ${first.name.split(" ")[0]} & ${second.name.split(" ")[0]}` ``.
- On reaching exactly 2 selections, plays the existing bounce
  (`withSequence(withSpring(1.06, spring), withSpring(1, spring))` —
  same pattern as `IntroDetailScreen`'s accept-button bounce) once, not on
  every re-render.
- `onPress`: `router.push({ pathname: "/matchmaker/note", params: { friendAId: selectedIds[0], friendBId: selectedIds[1] } })`.
  `/matchmaker/note` (Step 2) is not built in this pass — this is just the
  param handoff contract for whoever builds it next.

## Out of scope

- Step 2 (`/matchmaker/note`) screen itself.
- Any real Supabase query for friendships/introductions — mock data only,
  matching every other list screen in the app today.
- A real "Invite friends" destination screen.
- Server-side enforcement of the anti-spam cap (already noted in CLAUDE.md
  as a server-side rule; this screen only reflects `activePendingCount` from
  the fixture).
