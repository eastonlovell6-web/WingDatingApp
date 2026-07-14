# Discover + Request an Intro (Flow 2, browse + send half)

## Summary

Builds the two missing screens named in CLAUDE.md's file structure table for
Flow 2 ("User-initiated intro"): `app/(tabs)/discover.tsx` and
`app/request/[friendId].tsx`. This supersedes the entry-point decision in the
earlier `2026-07-12-request-an-intro-design.md` spec (which routed browsing
through a specific friend's profile with no dedicated screen) in favor of a
standalone Discover screen that aggregates friends-of-friends across all of
the viewer's friends at once, each result tagged with which mutual friend(s)
connect the viewer to them. Still privacy-scoped per CLAUDE.md ("Friend-of-
friend browse is scoped — never global profile discovery") — only people who
share a mutual friend with the viewer ever appear, never a global directory.

Scope is deliberately the "browse + send request" half only. Approving/
declining a request (the mutual friend's side) and status tracking
(Intros tab "Requested" section, nudge/withdraw for requests) are follow-up
work, consistent with the project's one-screen-at-a-time build discipline.
The backend for the half being built here already exists and is unused:
`intro_requests` table (`supabase/sql/001_notifications_schema.sql`), the
`request-introduction` Edge Function, and `requestIntroduction()` in
`lib/introductions.ts`.

## 1. Data

New mock fixture, `components/discover/mockDiscoverPeople.ts`:

```ts
interface DiscoverPerson {
  id: string;
  name: string;
  meta: string;
  photos: string[];
  mutualFriendIds: string[];       // ids into components/home/friendsMock.ts
  lookingToGetSetUp: boolean;      // same semantics as FriendProfile's flag
}
```

IDs are distinct from the viewer's own friends (`1`–`7` in `friendsMock.ts`/
`mockMatchmakerFriends.ts`/`mockFriendProfiles.ts`) — Discover never shows
people already in the viewer's friend list. A handful (5-6) of fixture people
are enough; most reference 1-2 `mutualFriendIds` drawn from the existing `1`-
`7` set, at least one references two mutuals (to exercise the mutual-picker
UI), and at least one has `lookingToGetSetUp: false` (to exercise the filter
below).

**Filter**: only people with `lookingToGetSetUp === true` are ever shown in
Discover. Someone who isn't open to being set up themselves — the same flag
that gates "Introduce X to someone" on the Friend Profile screen — must never
appear as a requestable target, wingman-only or not. This is enforced at the
data-read boundary (a `getDiscoverPeople()` accessor filtering the fixture
array), not just visually, so a future real-data swap inherits the same
guarantee.

## 2. `app/(tabs)/discover.tsx`

**Entry point**: a new icon button in `HomeHeader` (next to the existing
"Invite" button), wired via a new `onDiscoverPress` prop, `router.push
("/discover" as never)`.

**Navigation**: file lives in the `(tabs)` group (matches CLAUDE.md's file
table) but is excluded from the tab bar — `app/(tabs)/_layout.tsx` adds
`<Tabs.Screen name="discover" options={{ href: null }} />`. Reachable via
push, does not add a 5th tab button, doesn't disturb the existing 4-tab
design system requirement.

**Layout**: header (title "Discover", back chevron via `router.back()`),
then a 2-column grid of person cards, each:
- Photo (aspect ~4:5, `radii.xl`, matches `WingCardStack`'s `WingCard`
  visual weight but sized for a 2-up grid rather than a full-bleed carousel)
- Name + `meta` below the photo
- A `plum` "MUTUAL FRIEND"-style `Badge` (reusing the existing tone/variant
  the design system already reserves for this exact moment) captioned with
  the connecting friend's first name — `"via Maya"` when one mutual, `"via
  Maya +1"` when more than one
- Tap → `router.push(`/request/${person.id}?mutualIds=${person.mutualFriendIds.join(",")}` as never)`

**Empty state**: plain centered caption text if the (filtered) list is
empty — no fixture currently produces this, but the mock set isn't
guaranteed to stay non-empty as it's edited later.

## 3. `app/request/[friendId].tsx`

`friendId` param is the **target's** id (not the mutual friend's). Query
param `mutualIds` (comma-separated) carries which of the viewer's friends
connect them, sourced from Discover's own already-known data — this screen
doesn't re-derive mutuals from scratch.

**Chrome**: same bottom-sheet shell as `matchmaker/note.tsx`/`select.tsx` —
rounded top corners (`radii["2xl"]`), drag handle, X close (`router.back()`),
eyebrow label ("REQUEST AN INTRO").

**Body**:
- Target preview: photo, name, `meta` — minimal, no prompts panel (this
  isn't the Friend Profile screen, and the target isn't a friend yet).
- Mutual friend selector:
  - One id in `mutualIds` → shown inline, non-interactive ("via Maya" with
    her avatar).
  - Multiple ids → a row of avatar chips (visually reusing
    `FriendPickerChip`'s selected/unselected treatment, single-select
    instead of multi-select — a thin wrapper, not a fork, since the
    selection-ring/checkmark visuals are identical), defaulting to the
    first id selected.
- CTA: `"Ask [Mutual first name] to introduce you to [Target first name]"`,
  disabled while no mutual is resolved (only possible on a malformed/direct
  deep link) or while sending.

**Send**: calls `requestIntroduction(targetId, selectedMutualId)` from
`lib/introductions.ts` (already implemented, already wired to the real
Edge Function — no backend changes in this spec).

**Success**: `SendConfirmationOverlay` (in `components/matchmaker/`) gets a
new optional `message` prop, defaulting to its current copy ("Your intro is
on its way") so `matchmaker/note.tsx` is unaffected; this screen passes
`"Your request is on its way"`. On dismiss, `router.dismissTo("/(tabs)" as
never)` — same pattern as `note.tsx`.

**Errors**: `note.tsx`'s local `extractSendErrorMessage` helper (unwraps a
Supabase `FunctionsHttpError`'s `.context` Response to surface the Edge
Function's real JSON error body) moves to `lib/introductions.ts` as an
exported `extractFunctionErrorMessage(err, fallback)`, used by both
`note.tsx` and this new screen instead of forking the same ~15 lines.

**Malformed deep link** (target id not in the fixture list, or empty
`mutualIds`): mirrors `note.tsx`'s existing convention — `router.back()`
rather than a dedicated error state, since this route is only ever reached
via Discover's own navigation.

## Out of scope

- Anti-spam cap UI (3 outstanding pending requests) — the
  `request-introduction` Edge Function doesn't enforce this server-side yet
  either (pre-existing gap, confirmed while reading it), so no client-only
  enforcement is added here that the backend can't back up.
- Intros tab "Requested" section: approve/decline for the mutual friend,
  status tracking, nudge/withdraw for requests. A sent request currently has
  no UI to act on it beyond the push notification it triggers — this is
  follow-up work, matches this session's explicit scope decision.
- The per-friend "connections list" entry point from the 2026-07-12 spec
  (`app/friend/[friendId]/connections.tsx`) is superseded, not built.
  `app/friend/[friendId].tsx`'s existing "See who [Name] could introduce you
  to" button keeps its current `comingSoon()` stub — unchanged by this spec.
- Search/filter on the Discover grid.
