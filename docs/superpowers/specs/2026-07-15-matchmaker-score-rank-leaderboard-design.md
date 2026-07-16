# Matchmaker score, rank, badges, and leaderboard — real data

## Context

`2026-07-15-profile-matchmaker-counts-design.md` wired `introsSent`/
`introsAccepted`/`hasSentIntros`/`introducersCount` to real Supabase data but
explicitly deferred everything else on the Matchmaker tab as "a separate
product decision, not data-wiring": `score`, `percentileLabel`, the rank
system (`tier`/`level`/`xpCurrent`/`xpForNextLevel`/`streakWeeks`/
`streakAtRisk`/`streakResetsInDays`), `nextMilestoneCopy`, `badges`, and the
friend-group leaderboard (`MOCK_LEADERBOARD` in `app/(tabs)/intros.tsx`). This
spec makes that product decision and wires all of it to real data.

## Scope

Wire to real data:

- Matchmaker score (0-100)
- Percentile label
- Rank tier/level/XP
- Streak (weeks/at-risk/resets-in-days)
- Next-milestone copy
- Badges (Top Matchmaker / 5 Intros Sent / 3 Matches Made)
- Friend-group leaderboard (`app/(tabs)/intros.tsx`)

No new tables. No `matchmaker_stats` table — same live-compute precedent as
the prior spec.

## Data source: the RLS gap

`introductions_select_participant` restricts a client-side read to rows
where the caller is matchmaker/user_a/user_b. The leaderboard needs each
friend's accepted-intro count, and a friend's introductions rows don't
satisfy that policy for the caller. Same problem `discover-people` /
`discover-person` already solved for friends-of-friends browsing: a new
Edge Function using the admin (service-role) client.

### `supabase/functions/matchmaker-leaderboard/index.ts`

Follows the exact shape of `discover-people/index.ts`:

```ts
import { createAdminClient } from "../_shared/adminClient.ts";
import { getCallerId, UnauthorizedError } from "../_shared/verifyCaller.ts";
import { getDirectFriendIds } from "../_shared/friendGraph.ts";

Deno.serve(async (req: Request) => {
  try {
    const callerId = await getCallerId(req);
    const admin = createAdminClient();

    const friendIds = await getDirectFriendIds(admin, callerId);
    const ids = [callerId, ...friendIds];

    const [introsResult, usersResult] = await Promise.all([
      admin.from("introductions").select("matchmaker_id, status")
        .in("matchmaker_id", ids).neq("status", "withdrawn"),
      admin.from("users").select("id, name, photos").in("id", ids),
    ]);
    if (introsResult.error) throw introsResult.error;
    if (usersResult.error) throw usersResult.error;

    const statsById = new Map<string, { introsSent: number; introsAccepted: number }>();
    for (const id of ids) statsById.set(id, { introsSent: 0, introsAccepted: 0 });
    for (const row of introsResult.data ?? []) {
      const stats = statsById.get(row.matchmaker_id)!;
      stats.introsSent += 1;
      if (row.status === "accepted") stats.introsAccepted += 1;
    }

    const entries = (usersResult.data ?? []).map((user) => ({
      id: user.id,
      name: user.name ?? "",
      avatarUri: user.photos?.[0] ?? undefined,
      ...statsById.get(user.id)!,
    }));

    return new Response(JSON.stringify({ entries }), { status: 200 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: err.message }), { status: 401 });
    }
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
});
```

Reuses `getDirectFriendIds` (bidirectional friendships union) rather than
`getMatchmakerFriends`'s one-directional query — the leaderboard is "your
friend group," not "people you're permitted to introduce."

### `lib/introductions.ts` additions

```ts
export interface LeaderboardStatsEntry {
  id: string;
  name: string;
  avatarUri?: string;
  introsSent: number;
  introsAccepted: number;
}

export async function getMatchmakerLeaderboardStats(): Promise<LeaderboardStatsEntry[]> {
  const { data, error } = await supabase.functions.invoke<{ entries: LeaderboardStatsEntry[] }>(
    "matchmaker-leaderboard"
  );
  if (error) throw error;
  return data?.entries ?? [];
}
```

One query key, `["matchmakerLeaderboard", userId]`, shared between
`app/(tabs)/profile.tsx` (for rank/percentile/badges) and
`app/(tabs)/intros.tsx` (for the leaderboard card) — same cache-sharing
convention already used for `matchmakerFriends`.

## Formulas — `lib/matchmakerScore.ts` (new file, pure functions, no I/O)

Score, milestone copy, and rank/streak only need this user's own counts +
sent-intro timestamps (`getMatchmakerStats` + `getSentIntroductions`, both
already fetched). Percentile and badges additionally need this user's rank
within the leaderboard entries.

```ts
export function computeMatchmakerScore(introsSent: number, introsAccepted: number): number {
  return Math.min(100, introsAccepted * 15 + introsSent * 3);
}
```
Accepted intros weighted 5x sent — matches the existing "don't reward
spamming the pending cap" principle already documented on
`LeaderboardEntry.introsAccepted`.

```ts
export function computeNextMilestoneCopy(introsAccepted: number): string {
  const nextTarget = introsAccepted === 0 ? 5 : (Math.floor(introsAccepted / 5) + 1) * 5;
  const remaining = nextTarget - introsAccepted;
  return `${remaining} more accepted intro${remaining === 1 ? "" : "s"} to reach ${nextTarget}`;
}
```

```ts
export function computePercentileLabel(rank: number, groupSize: number): string {
  if (groupSize < 2) return "Invite friends to see how you rank.";
  const percentile = Math.round((rank / groupSize) * 100);
  return `You're in the top ${percentile}% of matchmakers in your friend group.`;
}
```

```ts
export function computeBadges(
  introsSent: number,
  introsAccepted: number,
  rank: number,
  groupSize: number
): MatchmakerBadge[] {
  const badges: MatchmakerBadge[] = [];
  if (rank === 1 && groupSize >= 2) {
    badges.push({ id: "top", label: "Top Matchmaker", tone: "butter", variant: "outline" });
  }
  if (introsSent >= 5) {
    badges.push({ id: "sent5", label: "5 Intros Sent", tone: "plum", variant: "outline" });
  }
  if (introsAccepted >= 3) {
    badges.push({ id: "accepted3", label: "3 Matches Made", tone: "mint", variant: "outline" });
  }
  return badges;
}
```

### Rank tier/level/XP

```ts
const XP_PER_LEVEL = 150;

function tierForLevel(level: number): MatchmakerRankProgress["tier"] {
  if (level >= 7) return "Matchmaker Legend";
  if (level >= 5) return "Cupid";
  if (level >= 3) return "Setup Artist";
  return "Wingperson";
}

export function computeRankLevel(introsSent: number, introsAccepted: number) {
  const xpCurrent = introsSent * 10 + introsAccepted * 25;
  const level = Math.floor(xpCurrent / XP_PER_LEVEL) + 1;
  return { xpCurrent, level, xpForNextLevel: level * XP_PER_LEVEL, tier: tierForLevel(level) };
}
```

XP is lifetime and never resets (matches "level" as a permanent-progression
concept, distinct from the weekly streak below).

### Streak

Weeks are Monday-anchored. Derives entirely from sent-intro `created_at`
timestamps (`getSentIntroductions`' `sentAt` field — already fetched on the
profile screen for `pendingIntro`).

```ts
function startOfWeek(date: Date): number {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function computeStreak(sentAtIsoTimestamps: string[], now: Date = new Date()) {
  const activeWeeks = new Set(sentAtIsoTimestamps.map((iso) => startOfWeek(new Date(iso))));
  const currentWeekStart = startOfWeek(now);
  const lastWeekStart = currentWeekStart - WEEK_MS;

  let anchor: number;
  let streakAtRisk: boolean;
  if (activeWeeks.has(currentWeekStart)) {
    anchor = currentWeekStart;
    streakAtRisk = false;
  } else if (activeWeeks.has(lastWeekStart)) {
    anchor = lastWeekStart;
    streakAtRisk = true;
  } else {
    return { streakWeeks: 0, streakAtRisk: false, streakResetsInDays: 0 };
  }

  let streakWeeks = 0;
  let cursor = anchor;
  while (activeWeeks.has(cursor)) {
    streakWeeks += 1;
    cursor -= WEEK_MS;
  }

  const streakResetsInDays = streakAtRisk
    ? Math.ceil((currentWeekStart + WEEK_MS - now.getTime()) / (24 * 60 * 60 * 1000))
    : 0;

  return { streakWeeks, streakAtRisk, streakResetsInDays };
}
```

`computeRankLevel` + `computeStreak` combine into the full
`MatchmakerRankProgress` shape `MatchmakerPanel` already expects — no
component changes needed, only real values instead of `MOCK_RANK_PROGRESS`.

## Leaderboard ranking — `components/intros/mockLeaderboard.ts`

Stays (renamed in spirit, not in filename — same convention as
`mockIntros.ts` keeping only its types after wiring). Delete
`MOCK_LEADERBOARD`. Keep `LeaderboardEntry` (add an `introsSent?: number`
field, unused by the UI, needed only for a deterministic tie-break) and
`rankedLeaderboard`, whose comparator becomes:

```ts
export function rankedLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort(
    (a, b) =>
      b.introsAccepted - a.introsAccepted ||
      (b.introsSent ?? 0) - (a.introsSent ?? 0) ||
      a.id.localeCompare(b.id)
  );
}
```

This is the single source of ranking truth — both `MatchmakerLeaderboardCard`
(already calls `rankedLeaderboard` + `findIndex` for `currentUserRank`) and
`profile.tsx` (for percentile/badges) derive rank from it, so there's no
duplicate ranking logic between the Edge Function and the client.

## Screen wiring

### `app/(tabs)/intros.tsx`

```ts
const { data: leaderboardStats = [] } = useQuery({
  queryKey: ["matchmakerLeaderboard", userId],
  queryFn: getMatchmakerLeaderboardStats,
  enabled: !!userId && hasSentIntros,
});
const leaderboardEntries: LeaderboardEntry[] = leaderboardStats.map((e) => ({
  id: e.id,
  name: e.name,
  avatarUri: e.avatarUri,
  introsAccepted: e.introsAccepted,
  introsSent: e.introsSent,
  isCurrentUser: e.id === userId,
}));
```
Replace `entries={MOCK_LEADERBOARD}` with `entries={leaderboardEntries}`.
`enabled` gated on `hasSentIntros` matches the card's existing render guard
— no point fetching the leaderboard for someone who's never sent an intro.

### `app/(tabs)/profile.tsx`

Reuses the same query (cache hit if the Intros tab was already visited this
session; a fresh fetch otherwise — both are fine, this is friend-group-sized
data, not expensive):

```ts
const { data: leaderboardStats = [] } = useQuery({
  queryKey: ["matchmakerLeaderboard", userId],
  queryFn: getMatchmakerLeaderboardStats,
  enabled: !!userId,
});
const ranked = rankedLeaderboard(
  leaderboardStats.map((e) => ({ ...e, isCurrentUser: e.id === userId }))
);
const rank = ranked.findIndex((e) => e.isCurrentUser) + 1;
const groupSize = ranked.length;

const introsSent = matchmakerStats?.introsSent ?? 0;
const introsAccepted = matchmakerStats?.introsAccepted ?? 0;
const score = computeMatchmakerScore(introsSent, introsAccepted);
const percentileLabel = computePercentileLabel(rank, groupSize);
const badges = computeBadges(introsSent, introsAccepted, rank, groupSize);
const rankLevel = computeRankLevel(introsSent, introsAccepted);
const streak = computeStreak(sentIntros.map((i) => i.sentAt));
const rankProgress: MatchmakerRankProgress = { ...rankLevel, ...streak };
const nextMilestoneCopy = computeNextMilestoneCopy(introsAccepted);
```

`rank` is always ≥ 1 since the Edge Function always includes the caller in
`ids`, so the caller is always present in `ranked` — no "not found" branch
needed.

### `components/profile/mockProfile.ts` cleanup

Delete `MOCK_MATCHMAKER_STATS`, `MOCK_RANK_PROGRESS`,
`MOCK_NEXT_MILESTONE_COPY`, `MOCK_BADGES`. Keep the `MatchmakerBadge` and
`MatchmakerRankProgress` type exports (now used by `matchmakerScore.ts` and
`profile.tsx`). `MOCK_PROFILE_USER`, `MOCK_PHOTOS`, `MOCK_PROMPTS`,
`MOCK_BLOCKED_COUNT`, `MOCK_PRIVACY_SETTINGS`, `PRESET_PROMPT_QUESTIONS` are
untouched — out of scope, unrelated gaps.

## Testing

No automated test infra for Supabase-backed screens exists in this repo
(consistent precedent, per prior specs). Manual plan:

1. Zero-friends account: leaderboard Edge Function returns a 1-entry list
   (self only) → `groupSize = 1` → percentile label falls back to "Invite
   friends…", no "Top Matchmaker" badge possible even if `introsAccepted` is
   highest (trivially, since there's no one else).
2. Multi-friend group with varying accepted counts: confirm leaderboard
   modal ranks correctly, `currentUserRank` in the collapsed card matches the
   modal's row order, and profile-tab percentile matches that same rank.
3. Send 5 intros (no acceptances yet): confirm "5 Intros Sent" badge
   appears, "3 Matches Made" doesn't, score reflects `introsSent * 3`.
4. Accept 3 of them: confirm "3 Matches Made" appears, score jumps by
   `introsAccepted * 15`.
5. Streak: hand-insert (SQL Editor) an `introductions` row with `created_at`
   backdated to last week and one to this week for the same matchmaker;
   confirm `streakWeeks = 2`, `streakAtRisk = false`. Remove this week's row;
   confirm `streakAtRisk = true` and `streakResetsInDays` matches days left
   until next Monday.
6. Level/tier: confirm `Lvl N` and tier name on the score-ring flip side
   change as `introsSent`/`introsAccepted` cross the 150-XP-per-level
   boundaries.

## Risks / edge cases

- Score/badges/rank formulas are a first-pass invented by this spec, not
  sourced from product research — same caveat the prior spec flagged for
  scope, now resolved by picking concrete numbers rather than leaving them
  undefined. Expect these constants (`15`/`3` score weights, `150` XP/level,
  badge thresholds) to get tuned later; they're isolated in
  `matchmakerScore.ts` for exactly that reason.
- `getDirectFriendIds` (bidirectional) can return a different, generally
  larger set than `getMatchmakerFriends` (one-directional, `friend_id =
  userId` only) — intentional per the "friend group" framing above, but
  means someone could appear on the leaderboard who isn't in the
  matchmaker's own Step-1 friend picker.
- Edge Function has no caller-supplied input, so no request-body validation
  is needed (same as `discover-people`).
