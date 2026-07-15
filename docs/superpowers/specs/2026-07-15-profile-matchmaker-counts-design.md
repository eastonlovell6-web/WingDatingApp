# Profile screen — real matchmaker counts

## Context

`app/(tabs)/profile.tsx`'s Matchmaker and Privacy tabs currently render entirely
from `components/profile/mockProfile.ts` and `components/intros/mockLeaderboard.ts`.
`matchmaker_stats` is documented in `CLAUDE.md` as a future table
(`user_id, intros_sent, intros_accepted`) but was never created — nothing
queries it for real. This is the next screen in the "one screen at a time"
build order and the highest-impact gap, since it's live-in-app but showing
fake numbers.

## Scope

Wire these mock values to real Supabase data:

- `introsSent` — count of introductions this user has sent as matchmaker
- `introsAccepted` — count of those that reached `accepted` status
- `hasSentIntros` — derived from `introsSent > 0`
- `introducersCount` — count of friends who can introduce this user

**Out of scope, left mock:** `score`, `percentileLabel`, rank
`tier`/`level`/`xpCurrent`/`xpForNextLevel`/`streakWeeks`/`streakAtRisk`/
`streakResetsInDays`, `nextMilestoneCopy`, `badges`, and the friend-group
leaderboard (`MOCK_LEADERBOARD` in `app/(tabs)/intros.tsx`). None of these
have a formula anywhere in the codebase — `mockProfile.ts` explicitly notes
they need "real progression math" that doesn't exist yet. Designing that
formula is a separate product decision, not data-wiring, and is a follow-up
conversation.

## Data source decision

No new table, no triggers. Compute both counts live from tables that already
exist (`introductions`, `friendships`) using Postgres `count: "exact", head:
true` queries — cheap at Wing's current scale (single-campus beachhead) and
avoids any risk of a maintained counter drifting from the source of truth.
The documented-but-uncreated `matchmaker_stats` table stays undocumented from
schema reality until/unless a real need for a maintained counter shows up
(e.g. the leaderboard needing many users' counts at once cheaply).

## Implementation

### `lib/introductions.ts` — `getMatchmakerStats`

```ts
export interface MatchmakerStats {
  introsSent: number;
  introsAccepted: number;
}

export async function getMatchmakerStats(matchmakerId: string): Promise<MatchmakerStats>
```

Two parallel count queries against `introductions`, both filtered
`.eq("matchmaker_id", matchmakerId)`:

- `introsSent`: `.neq("status", "withdrawn")` — same exclusion convention as
  `getSentIntroductions` (a withdrawn intro was never "sent").
- `introsAccepted`: `.eq("status", "accepted")`.

Existing `introductions_select_participant` RLS policy already covers a
matchmaker reading their own rows — no policy change needed.

### `lib/friendships.ts` — `getIntroducersCount`

```ts
export async function getIntroducersCount(userId: string): Promise<number>
```

One count query against `friendships`: `.eq("user_id", userId).eq("can_introduce",
true)`. Per the direction convention already documented on
`getMatchmakerFriends` in this file (`user_id` = the friend who granted
permission, `friend_id` = the person allowed to introduce them) — rows where
`user_id = userId` are the ones *this user* granted, so counting those with
`can_introduce = true` gives the number of friends allowed to introduce this
user. Existing `friendships_select_participant` policy already covers this
(`auth.uid() = user_id`).

### `app/(tabs)/profile.tsx`

Two new `useQuery` calls:

```ts
const { data: matchmakerStats } = useQuery({
  queryKey: ["matchmakerStats", userId],
  queryFn: () => getMatchmakerStats(userId!),
  enabled: !!userId,
});
const { data: introducersCount } = useQuery({
  queryKey: ["introducersCount", userId],
  queryFn: () => getIntroducersCount(userId!),
  enabled: !!userId,
});
```

`MatchmakerPanel` receives `introsSent={matchmakerStats?.introsSent ?? 0}`,
`introsAccepted={matchmakerStats?.introsAccepted ?? 0}`,
`hasSentIntros={(matchmakerStats?.introsSent ?? 0) > 0}`. `score` and
`percentileLabel` keep coming from `MOCK_MATCHMAKER_STATS`.

`PrivacyPanel` receives `introducersCount={introducersCount ?? 0}`.

### `components/profile/mockProfile.ts` cleanup

- Remove `introsSent`/`introsAccepted` from `MOCK_MATCHMAKER_STATS` (keep
  `score`/`percentileLabel` — still mock).
- Delete `MOCK_HAS_SENT_INTROS` and `MOCK_INTRODUCERS_COUNT` exports —
  both now real. Neither is imported anywhere outside `profile.tsx`.

## Testing

- Manual: sign in as a user with zero sent intros → empty-nudge state shows
  (not the stat tiles). Send an intro, confirm `introsSent` increments after
  refetch. Accept an intro from the other side, confirm `introsAccepted`
  increments. Toggle a friend's `can_introduce`, confirm `introducersCount`
  updates.
- No new automated test infra exists in this repo for Supabase-backed
  screens (chat/intros wiring shipped without one) — stay consistent with
  that precedent rather than introducing one here.

## Risks / edge cases

- A brand-new user with no `introductions` rows: both counts are `0`,
  `hasSentIntros` is `false` → empty-nudge state renders correctly, matching
  today's `MOCK_HAS_SENT_INTROS = true` demo default being replaced by real
  `false`.
- `matchmakerId`/`userId` undefined before auth resolves: queries are
  `enabled: !!userId`, matching the existing `sentIntroductions` query's
  guard.
