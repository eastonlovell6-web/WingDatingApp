# Friend Visibility Settings screen

## Context

Last unbuilt v1 screen in `CLAUDE.md`'s build order. `PrivacyPanel`'s "Who can
introduce you" row (`components/profile/PrivacyPanel.tsx:167-175`) already
shows a live count (`getIntroducersCount`) and calls `onVisibilityPress`, but
`app/(tabs)/profile.tsx:288` wires that to the `comingSoon("Friend visibility
settings")` stub — there's nowhere to actually change who can introduce you.

Two gaps make this bigger than just a new screen:

- `friendships` has no UPDATE policy. `supabase/sql/002_users_friendships_schema.sql`
  explicitly flags this: "No write policy yet: nothing in the app creates
  friendships rows today (the Friend Visibility Settings / contact-sync
  screen isn't built). Add an insert/update policy here when that screen
  ships."
- Nothing in the app creates `friendships` rows at all yet — onboarding's
  friend-visibility step (`app/(auth)/onboarding.tsx`) still renders
  `MOCK_FRIENDS`, a hardcoded placeholder, and never persists anything.

## Scope

**In scope:** list the signed-in user's existing friendships and let them
toggle `can_introduce` per friend, with a "new friend" badge/sort surfaced on
top of the same list.

**Out of scope:** adding new friends / contacts-sync. This screen only
operates on `friendships` rows that already exist in the database (currently
seeded by hand — see `002_users_friendships_schema.sql`'s header comment on
how `users`/`friendships` reality was captured). Building the flow that
actually creates `friendships` rows is a separate, future project.

## Data model

Per the direction convention already documented on `getMatchmakerFriends` in
`lib/friendships.ts`: a `friendships` row's `user_id` is the friend who
granted permission, `friend_id` is the person allowed to introduce them. This
screen manages *my own* grants, so it operates on rows where
`user_id = <signed-in user>` — the same rows `getIntroducersCount` already
counts.

"New" friend = `friendships.created_at` within the last 7 days. No new
column; `created_at` already exists on the table.

### Database change (hand-apply required)

New `supabase/sql/006_friendships_update_policy.sql`:

```sql
create policy "friendships_update_own" on friendships
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Same trust model as the rest of this schema (e.g. `users`' self-update
policy): no column-level lock, the client is trusted to only ever write
`can_introduce`. Must be applied by hand in the Supabase SQL Editor, same as
`001`–`005` — this repo has no migrations runner. **The screen will load and
render but toggles won't persist until this is applied.**

## Implementation

### `lib/friendships.ts` — new functions

```ts
export interface FriendVisibilityEntry {
  id: string;
  name: string;
  imageUri?: string;
  canIntroduce: boolean;
  createdAt: string;
  isNew: boolean; // createdAt within the last 7 days
}

export async function getFriendVisibilityList(userId: string): Promise<FriendVisibilityEntry[]>
```

Same two-step fetch pattern as `getMatchmakerFriends` (`friendships` then
`users` by id, since PostgREST embed constraint-hints don't apply here
either): `.from("friendships").select("friend_id, can_introduce,
created_at").eq("user_id", userId)`, then a batch `users` fetch on the
resulting `friend_id`s for `name`/`photos`.

Sort before returning: `isNew` friends first (newest `createdAt` first
within that group), then everyone else alphabetical by `name`. Sorting in
the data layer (not the screen) keeps `FriendVisibilityList`'s existing
search-filter behavior working unchanged — search filters the pre-sorted
array, order is preserved.

```ts
export async function setFriendCanIntroduce(
  userId: string,
  friendId: string,
  canIntroduce: boolean
): Promise<void>

export async function setAllFriendsCanIntroduce(
  userId: string,
  friendIds: string[],
  canIntroduce: boolean
): Promise<void>
```

`setFriendCanIntroduce`: single update, `.eq("user_id", userId).eq("friend_id",
friendId)`. `setAllFriendsCanIntroduce`: same shape with `.in("friend_id",
friendIds)`, for the Select All / None quick actions.

### `components/onboarding/FriendVisibilityRow.tsx`

Add two optional props so onboarding's existing usage (no `createdAt` data)
is unaffected:

```ts
{
  // ...existing props
  isNew?: boolean;
  caption?: string;
}
```

When `isNew`, render a small `Badge` (`components/ui/Badge`, `tone="butter"`,
matching `PENDING`'s existing warm/attention color) reading `NEW` next to the
name. When `caption` is provided, render it under the name in `ink[500]`
(same treatment as `PrivacyPanel`'s `NavRow` caption line).

`FriendVisibilityList` passes these through unchanged from whatever `friends`
array it's given — no changes needed there beyond widening its prop type to
accept the optional fields.

### `app/settings/friend-visibility.tsx` (new screen)

Plain push route — no `Stack.Screen` entry needed in `app/_layout.tsx`
(`headerShown: false` is already the global default; only modal presentations
get explicit entries, per the existing `matchmaker/select`,
`matchmaker/prompt-friends`, `request/[friendId]` registrations).

Layout, following `friend/[friendId].tsx`'s back-button convention rather
than onboarding's chrome (this is a Profile/Settings surface, not an
onboarding step):

- Header row: back `Pressable` + `BackIcon` (copied pattern), `"Friend
  visibility"` in `textStyles.heading`, caption line "Choose who can
  introduce you" in `textStyles.caption`.
- Body: `FriendVisibilityList` wrapped in `GroupCard` (import from
  `PrivacyPanel.tsx` or lift to a shared location if reused a third time —
  YAGNI for now, two usages doesn't justify extraction yet) so it visually
  matches the rest of the Privacy tab's cards.
- Loading state: simple centered spinner while `getFriendVisibilityList`
  resolves.
- Empty state (`friends.length === 0`): centered text, "You don't have any
  friends on Wing yet." No CTA — adding friends isn't built.

Caption per row (passed into `FriendVisibilityRow`):
`isNew ? \`Joined ${formatRelativeTime(createdAt)}\` : \`Friend since
${new Date(createdAt).toLocaleDateString("en-US", { month: "long" })}\`` —
reuses `lib/format.ts`'s existing `formatRelativeTime`, no new formatting
helper.

Toggle handling — optimistic, matching `persistPhotos`'s pattern in
`profile.tsx`: flip local state immediately, fire
`setFriendCanIntroduce`/`setAllFriendsCanIntroduce` in the background,
`console.error` on failure without reverting (consistent with this
codebase's existing risk tolerance for settings writes). On success, also
`queryClient.invalidateQueries({ queryKey: ["introducersCount", userId] })` —
the explicit-invalidation pattern used everywhere else in this codebase
after a mutation (`matchmaker/note.tsx:77`, `intro/[id].tsx:82`,
`(tabs)/chats.tsx:29`), not a focus-refetch — so the Privacy tab's count is
correct when the user navigates back to it.

### `app/(tabs)/profile.tsx`

Replace `onVisibilityPress={() => comingSoon("Friend visibility settings")}`
(line 288) with `onVisibilityPress={() => router.push("/settings/friend-visibility")}`.

## Testing

- RN-web preview: navigate Profile → Privacy → "Who can introduce you",
  confirm the list loads, confirm a friend created within 7 days shows the
  `NEW` badge and sorts above older friends.
- Toggle a friend off, navigate back to Privacy tab, confirm
  `introducersCount` decrements via the `invalidateQueries` call above.
- Toggle a friend on with the DB policy *not yet applied* — confirm the UI
  still optimistically flips (and logs the RLS error to console) rather than
  crashing, since the policy is a manual follow-up step outside this code
  change.
- Select All / None against a multi-friend list, confirm all rows update.
- No automated test infra exists for Supabase-backed screens in this repo
  (chat/intros wiring shipped without one) — stay consistent with that
  precedent.

## Risks / edge cases

- Policy not yet applied in a given environment: toggles fail silently
  (console-logged) per the optimistic-update convention above — same
  failure mode as an unsaved photo/prompt edit elsewhere in this codebase.
- Zero friendships rows (fresh dev/test account): empty state, no crash.
- `created_at` exactly at the 7-day boundary: inclusive vs exclusive doesn't
  matter at this precision — no test depends on the exact boundary instant.
