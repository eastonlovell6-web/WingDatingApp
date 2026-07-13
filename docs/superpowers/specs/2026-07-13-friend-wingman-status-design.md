# Friend "Solely a Wingman" Status — Design

## Problem

Friend Profile always shows both "Introduce [Name] to someone" and "See who
[Name] could introduce you to" (gated only by the existing `canIntroduce` /
`connectionsVisible` privacy flags). There's no way to represent a friend who
is currently only acting as a matchmaker for others (e.g. already in a
relationship) and isn't looking to be introduced themselves. Such a friend
should never surface the "Introduce to someone" action, but should still be
askable for intros through their own connections.

## Data Model

Add a new field, independent of the existing privacy flags:

```ts
// true = wants to be introduced to others (and can still matchmake too)
// false = solely a wingman right now — e.g. in a relationship
lookingToGetSetUp: boolean;
```

Added to both:
- `FriendProfile` in `components/friend/mockFriendProfiles.ts`
- `MatchmakerFriend` in `components/matchmaker/mockMatchmakerFriends.ts`

This is orthogonal to `canIntroduce` (per-viewer permission to introduce this
friend) and `connectionsVisible` (friend allows viewer to request intros
through them) — both of those are unchanged privacy gates.

Mock data: all 7 friends get `lookingToGetSetUp: true` except Maya Chen
(id `"4"`), who gets `false`, to demonstrate the new behavior without
disturbing the existing `not_opted_in` (Theo Marsh) / `at_cap` (Ana Sousa)
demo cases in the matchmaker picker.

## Friend Profile Screen (`app/friend/[friendId].tsx`)

- "Introduce [Name] to someone" condition changes from
  `friend.canIntroduce` to `friend.canIntroduce && friend.lookingToGetSetUp`.
- "See who [Name] could introduce you to" stays gated by
  `friend.connectionsVisible` alone — unchanged.
- `FriendProfileHeader` gets a new optional prop to render a status badge
  when `lookingToGetSetUp === false`. No badge renders when `true` (the
  default state doesn't need a label).
  - Badge style matches the existing `MUTUAL FRIEND` convention: plum-100
    fill, plum-600 text, DM Mono uppercase, pill shape.
  - Copy: **"SOLELY A WINGMAN"**.
  - Placement: directly under the meta line in `FriendProfileHeader`.

## Matchmaker Step 1 Picker (`components/matchmaker/mockMatchmakerFriends.ts`)

- `FriendEligibility` gets a new value: `"not_looking"`.
- `getFriendEligibility()` checks `lookingToGetSetUp` first (before
  `canIntroduce` / `activePendingCount`), since not-looking is the more
  fundamental reason a friend can't be introduced.
- `getIneligibleCaption()` gets a caption for `"not_looking"`:
  **"Not looking to be set up"**.
- No changes needed in `FriendPickerChip` or `FriendPickerGrid` — captions
  already render generically from `FriendEligibility`.

## Out of Scope

- No changes to onboarding intent (`wing-me` / `wing-somebody`) — this status
  is a separate, independently-updatable attribute (per user decision), not
  derived from the one-time onboarding choice.
- No new settings UI for a user to toggle their own `lookingToGetSetUp` —
  mock data only, same as the rest of the friend/matchmaker data model today.
- No badge for the default (`true`) state.

## Testing

- Typecheck passes.
- Manual verification via the running Expo dev server:
  - Maya Chen's Friend Profile shows the badge and only the "See who Maya
    could introduce you to" button.
  - Maya Chen's chip in Matchmaker Step 1 is disabled with "Not looking to
    be set up" caption.
  - Sam Rivera (or another `lookingToGetSetUp: true` friend) is unaffected —
    both buttons still show, chip still eligible.
  - Theo Marsh (`not_opted_in`) and Ana Sousa (`at_cap`) demo cases still
    show their original captions, unaffected by the new field.
