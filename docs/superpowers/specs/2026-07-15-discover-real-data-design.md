# Discover screen — real friends-of-friends data

## Context

`app/(tabs)/discover.tsx` and `app/request/[friendId].tsx` currently run
entirely on `components/discover/mockDiscoverPeople.ts` — a fixed 5-person
fixture (`getDiscoverPeople()`). This is the same mock-vs-real mismatch
already fixed for the Matchmaker friend picker (`getMatchmakerFriends`) and
Profile counts (`getMatchmakerStats`/`getIntroducersCount`): the screen is
live and reachable in the app, but every person it shows is fake, and the ids
it sends into `requestIntroduction()` don't correspond to real `users` rows.

## Scope

Replace the mock fixture with a real friends-of-friends query and wire both
screens to it. `meta` (age/school/location) stays the shared
`MOCK_PROFILE_USER.meta` placeholder — no age/school/location columns exist
on `users` yet, same documented gap as `matchAge`/`matchTagline` on the intro
detail screen. No changes to `requestIntroduction()` or the
`request-introduction` Edge Function — both already work against real ids.

## Why this needs new Edge Functions, not a client query

`friendships` RLS (`friendships_select_participant`) only lets a user read
rows where they themselves are `user_id` or `friend_id`. Computing
friends-of-friends requires reading rows connecting the viewer's *friends* to
other people — rows the viewer isn't a party to. Two options:

1. Widen the RLS policy to any row within 2 hops of the viewer.
2. Compute server-side with the admin client, in an Edge Function, returning
   only resolved names/photos/mutual-friend info — never raw rows between
   third parties.

Going with (2): Wing's whole product pitch is a tightly-scoped social graph
(matchmaker firewall, no read receipts, "friend-of-friend browse is
scoped — never global profile discovery"). Widening RLS would let any user
within 2 hops of you read raw rows of who's friends with whom in that
neighborhood — a real crack in that guarantee. An Edge Function matches the
existing convention for anything cross-user (`send-introduction`,
`request-introduction`, `respond-to-introduction`, etc. all use the admin
client for exactly this reason).

## Direct-friend definition

A `friendships` row's existence represents the underlying contact
relationship itself (per the schema comment in
`002_users_friendships_schema.sql`), independent of which side owns
`can_introduce`. So "my direct friends" = the union of `friend_id` where
`user_id = me` and `user_id` where `friend_id = me`. This differs from
`getMatchmakerFriends`, which deliberately looks at only one direction
(friends who granted *me* permission) — that's a permission slice, not the
full contact graph, and isn't the right definition for "who does my friend
network include."

## 1. `supabase/functions/_shared/friendGraph.ts` (new, shared)

```ts
export async function getDirectFriendIds(admin: SupabaseClient, userId: string): Promise<string[]>
```
Two queries (`user_id = userId`, `friend_id = userId`), unioned, deduped,
excluding `userId` itself.

```ts
export interface DiscoverCandidate {
  id: string;
  name: string;
  photos: string[];
  mutuals: { id: string; name: string; imageUri?: string }[];
}

export async function getFriendsOfFriends(
  admin: SupabaseClient,
  userId: string,
  directFriendIds: string[],
  onlyCandidateId?: string
): Promise<DiscoverCandidate[]>
```
- Fetches `friendships` rows where `user_id` or `friend_id` is in
  `directFriendIds`, builds candidateId → Set<directFriendId> ("via" map).
- Excludes `userId` and anyone already in `directFriendIds`.
- If `onlyCandidateId` is given, filters the candidate set to just that id
  before the `users` fetch (used by `discover-person`; avoids fetching/
  returning the whole network for a single-target lookup).
- Fetches `users` rows (`id, name, photos, role`) for the remaining
  candidate ids; filters to `role !== 'wing-somebody'` (same convention as
  `getMatchmakerFriends`) and at least one photo (a photo-grid/profile card
  with no image isn't a real state worth designing for).
- Fetches `users` rows for the directFriendIds referenced in surviving
  candidates' "via" sets (`id, name, photos`), to resolve `mutuals`.
- Returns `DiscoverCandidate[]` with `mutuals` sorted stable (insertion
  order) — `discover-people`'s caller picks `mutuals[0]` for the card badge,
  same as the current mock's `mutualCaption`.

Both Edge Functions become thin wrappers: `getCallerId` → `getDirectFriendIds`
→ `getFriendsOfFriends` → JSON response.

## 2. `supabase/functions/discover-people/index.ts` (new)

No request body. Returns `{ people: DiscoverCandidate[] }`. Empty
`directFriendIds` short-circuits to `{ people: [] }` without the second
query.

## 3. `supabase/functions/discover-person/index.ts` (new)

Body: `{ targetId: string }`. Calls `getFriendsOfFriends(..., onlyCandidateId:
targetId)`. Returns `{ person: DiscoverCandidate | null }` — `null` covers
both a malformed id and a target who's no longer a valid 2-hop connection
(revoked friendship, went `wing-somebody`, etc.), same graceful-fallback
shape `getIntroductionDetail` already uses for "not a participant."

## 4. `lib/discover.ts` (new)

```ts
export interface DiscoverPerson {
  id: string;
  name: string;
  meta: string;
  photos: string[];
  mutuals: WingFriend[];
}

export async function getDiscoverPeople(): Promise<DiscoverPerson[]>
export async function getDiscoverPersonDetail(targetId: string): Promise<DiscoverPerson | null>
```

Both call `supabase.functions.invoke(...)`, throw on `error` (caller handles
via React Query), and attach `meta: MOCK_PROFILE_USER.meta` client-side to
each result — mirrors how `matchAge`/`matchTagline` get attached in
`getIntroductionDetail`.

`components/discover/mockDiscoverPeople.ts` is deleted — its `DiscoverPerson`
type moves into `lib/discover.ts` (shape changed: `mutualFriendIds: string[]`
→ `mutuals: WingFriend[]`, `lookingToGetSetUp` dropped since filtering is now
server-side). `MOCK_FRIENDS` import is no longer needed by either screen.

## 5. `app/(tabs)/discover.tsx`

`const people = getDiscoverPeople();` (sync) becomes:

```ts
const { data: people, isLoading } = useQuery({
  queryKey: ["discoverPeople", userId],
  queryFn: getDiscoverPeople,
  enabled: !!userId,
});
```

Card tap: `router.push(`/request/${person.id}` as never)` — no more
`?mutualIds=` param, since `request/[friendId].tsx` now re-derives mutuals
itself. `DiscoverPersonCard` gets `person.mutuals` directly instead of a
separately-computed `mutuals` prop from `MOCK_FRIENDS.filter(...)`.

Loading state: reuse the existing empty-state text slot with a neutral
"Loading..." caption while `isLoading` — this screen has no skeleton/spinner
precedent elsewhere to match, and a brief text flash is consistent with how
sparse the rest of the loading UI is across the app.

## 6. `app/request/[friendId].tsx`

Drops `mutualIds` param entirely. Replaces the synchronous
`getDiscoverPeople().find(...)` + `MOCK_FRIENDS.filter(...)` with:

```ts
const { data: person, isLoading } = useQuery({
  queryKey: ["discoverPerson", friendId],
  queryFn: () => getDiscoverPersonDetail(friendId!),
  enabled: !!friendId,
});
const mutuals = person?.mutuals ?? [];
```

The existing "back out if not found" `useEffect` fires once `isLoading` is
false and `person` is `null`/`mutuals.length === 0` — same graceful-fallback
convention as today, now also covering a target that's fallen out of the
2-hop network between navigation and load (e.g. a friendship was removed).

## Out of scope

- Search/filter/pagination on the Discover grid — current mock has none,
  and per CLAUDE.md's launch context ("users test with 1-2 friends before
  expanding network") the 2-hop network is expected to be small for the
  foreseeable future.
- Anti-spam cap enforcement on `intro_requests` — pre-existing gap in
  `request-introduction`, out of scope for a read-path change.
- Any change to `requestIntroduction()` / `request-introduction` — already
  correct against real ids, untouched by this spec.

## Testing

- Manual: seed 2+ `friendships` rows two hops out from a test account,
  confirm they appear in Discover with the right "via" name; confirm a
  direct friend never appears; confirm a `wing-somebody`-role or zero-photo
  candidate is excluded; tap into `request/[friendId].tsx` and confirm the
  mutual selector and send flow still work against a real `targetId`.
- No new automated test infra — consistent with every other real-data
  wiring spec in this repo (Profile counts, Matchmaker friends, chat).

## Risks / edge cases

- A brand-new user with zero `friendships` rows: `directFriendIds` is empty,
  Discover renders its existing empty state — no query error.
- A user who is 2 hops from someone via *multiple* direct friends: `mutuals`
  includes all of them (matches today's mock's `Marcus Webb`/`Owen Bryant`
  multi-mutual fixture entries, which exercise the "+N" badge and the
  mutual-picker row).
