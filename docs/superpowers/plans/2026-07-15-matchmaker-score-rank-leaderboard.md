# Matchmaker Score, Rank, Badges, and Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the last mock data on the Matchmaker tab (score, percentile, rank tier/level/XP, streak, badges, next-milestone copy, friend-group leaderboard) with real Supabase-backed values.

**Architecture:** A new Edge Function (`matchmaker-leaderboard`) aggregates the caller's + their friends' intro counts server-side (client-side RLS can't read another user's `introductions` rows). A new pure-function module (`lib/matchmakerScore.ts`) turns raw counts + a leaderboard rank into score/badges/rank-progress/streak — no I/O, fully unit-testable in isolation. Two screens (`profile.tsx`, `intros.tsx`) wire these together via React Query, sharing one query key so both tabs read the same cached leaderboard fetch.

**Tech Stack:** TypeScript (strict), React Query, Supabase (Postgres + Edge Functions/Deno), Expo Router.

## Global Constraints

- No new database tables — compute everything live from `introductions`/`friendships`/`users` (per spec's "Data source" sections, consistent with the prior `matchmaker_stats`-avoidance precedent).
- `messages` table has no `read_at` column — unrelated to this work, do not touch.
- Matchmaker-firewall privacy rule: never expose per-intro `status` to anyone but the introduction's own participants — the leaderboard Edge Function only ever returns aggregate counts (`introsSent`/`introsAccepted`), never raw `introductions` rows or `status` values, to the client.
- Keep files under 500 lines.
- This repo has no automated test runner configured (no jest, no test script in `package.json`, no `supabase` CLI available in this environment) — verification uses `npx tsc --noEmit` for type safety and disposable Node scripts (compiled via `tsc` to a temp dir, deleted after) to exercise pure functions. This matches the project's existing precedent of manual verification for Supabase-backed screens.
- The `matchmaker-leaderboard` Edge Function cannot be deployed or invoked from this environment (no Supabase CLI/Docker access) — its correctness is verified by exact structural parity with the already-deployed `discover-people` function, and deployment is a manual step for the user (same as every other Edge Function in this repo).

---

### Task 1: `lib/matchmakerScore.ts` — pure score/rank/badge/streak formulas

**Files:**
- Create: `lib/matchmakerScore.ts`

**Interfaces:**
- Consumes: `MatchmakerBadge`, `MatchmakerRankProgress` types from `components/profile/mockProfile.ts` (already exist, untouched by this task).
- Produces (used by Task 6 / `app/(tabs)/profile.tsx`):
  - `computeMatchmakerScore(introsSent: number, introsAccepted: number): number`
  - `computeNextMilestoneCopy(introsAccepted: number): string`
  - `computePercentileLabel(rank: number, groupSize: number): string`
  - `computeBadges(introsSent: number, introsAccepted: number, rank: number, groupSize: number): MatchmakerBadge[]`
  - `computeRankLevel(introsSent: number, introsAccepted: number): { xpCurrent: number; level: number; xpForNextLevel: number; tier: MatchmakerRankProgress["tier"] }`
  - `computeStreak(sentAtIsoTimestamps: string[], now?: Date): { streakWeeks: number; streakAtRisk: boolean; streakResetsInDays: number }`

- [ ] **Step 1: Write the implementation**

```ts
// lib/matchmakerScore.ts
import type { MatchmakerBadge, MatchmakerRankProgress } from "../components/profile/mockProfile";

/**
 * Accepted intros weighted 5x sent ones — rewards intros that actually land,
 * not just hitting send (matches the leaderboard's own ranking rationale in
 * components/intros/mockLeaderboard.ts).
 */
export function computeMatchmakerScore(introsSent: number, introsAccepted: number): number {
  return Math.min(100, introsAccepted * 15 + introsSent * 3);
}

export function computeNextMilestoneCopy(introsAccepted: number): string {
  const nextTarget = introsAccepted === 0 ? 5 : (Math.floor(introsAccepted / 5) + 1) * 5;
  const remaining = nextTarget - introsAccepted;
  return `${remaining} more accepted intro${remaining === 1 ? "" : "s"} to reach ${nextTarget}`;
}

export function computePercentileLabel(rank: number, groupSize: number): string {
  if (groupSize < 2) return "Invite friends to see how you rank.";
  const percentile = Math.round((1 - (rank - 1) / groupSize) * 100);
  return `You're in the top ${percentile}% of matchmakers in your friend group.`;
}

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

const XP_PER_LEVEL = 150;

function tierForLevel(level: number): MatchmakerRankProgress["tier"] {
  if (level >= 7) return "Matchmaker Legend";
  if (level >= 5) return "Cupid";
  if (level >= 3) return "Setup Artist";
  return "Wingperson";
}

/** XP is lifetime and never resets — a separate concept from the weekly streak below. */
export function computeRankLevel(
  introsSent: number,
  introsAccepted: number
): { xpCurrent: number; level: number; xpForNextLevel: number; tier: MatchmakerRankProgress["tier"] } {
  const xpCurrent = introsSent * 10 + introsAccepted * 25;
  const level = Math.floor(xpCurrent / XP_PER_LEVEL) + 1;
  return { xpCurrent, level, xpForNextLevel: level * XP_PER_LEVEL, tier: tierForLevel(level) };
}

function startOfWeek(date: Date): number {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Weeks are Monday-anchored. streakAtRisk means last week had an intro sent
 * but this week doesn't yet — the streak survives until this week ends.
 */
export function computeStreak(
  sentAtIsoTimestamps: string[],
  now: Date = new Date()
): { streakWeeks: number; streakAtRisk: boolean; streakResetsInDays: number } {
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
    ? Math.ceil((currentWeekStart + WEEK_MS - now.getTime()) / DAY_MS)
    : 0;

  return { streakWeeks, streakAtRisk, streakResetsInDays };
}
```

- [ ] **Step 2: Write a throwaway verification script and run it**

```bash
tmpdir=$(mktemp -d) && npx tsc lib/matchmakerScore.ts --outDir "$tmpdir" --module commonjs --target es2019 --skipLibCheck --esModuleInterop && node -e "
const assert = require('assert');
const m = require('$tmpdir/matchmakerScore.js');

assert.strictEqual(m.computeMatchmakerScore(0, 0), 0);
assert.strictEqual(m.computeMatchmakerScore(5, 3), 60); // 3*15 + 5*3
assert.strictEqual(m.computeMatchmakerScore(50, 50), 100); // capped

assert.strictEqual(m.computeNextMilestoneCopy(0), '5 more accepted intros to reach 5');
assert.strictEqual(m.computeNextMilestoneCopy(4), '1 more accepted intro to reach 5');
assert.strictEqual(m.computeNextMilestoneCopy(5), '5 more accepted intros to reach 10');

assert.strictEqual(m.computePercentileLabel(1, 1), 'Invite friends to see how you rank.');
assert.strictEqual(m.computePercentileLabel(1, 4), \"You're in the top 100% of matchmakers in your friend group.\");
assert.strictEqual(m.computePercentileLabel(4, 4), \"You're in the top 25% of matchmakers in your friend group.\");

assert.deepStrictEqual(m.computeBadges(0, 0, 1, 1), []);
assert.deepStrictEqual(m.computeBadges(5, 0, 2, 4), [{ id: 'sent5', label: '5 Intros Sent', tone: 'plum', variant: 'outline' }]);
assert.deepStrictEqual(
  m.computeBadges(5, 3, 1, 4),
  [
    { id: 'top', label: 'Top Matchmaker', tone: 'butter', variant: 'outline' },
    { id: 'sent5', label: '5 Intros Sent', tone: 'plum', variant: 'outline' },
    { id: 'accepted3', label: '3 Matches Made', tone: 'mint', variant: 'outline' },
  ]
);
assert.deepStrictEqual(m.computeBadges(0, 0, 1, 1), []); // rank 1 of 1 is not 'top' (groupSize < 2)

const level1 = m.computeRankLevel(0, 0);
assert.deepStrictEqual(level1, { xpCurrent: 0, level: 1, xpForNextLevel: 150, tier: 'Wingperson' });
const level5 = m.computeRankLevel(10, 20); // xp = 100 + 500 = 600 -> level 5
assert.deepStrictEqual(level5, { xpCurrent: 600, level: 5, xpForNextLevel: 750, tier: 'Cupid' });

const noStreak = m.computeStreak([]);
assert.deepStrictEqual(noStreak, { streakWeeks: 0, streakAtRisk: false, streakResetsInDays: 0 });

// Wed of week 1, Wed of week 2 (this week), 'now' = that same Wed -> 2-week streak, not at risk.
const thisWeekWed = new Date('2026-07-15T12:00:00Z'); // a Wednesday
const lastWeekWed = new Date('2026-07-08T12:00:00Z');
const twoWeekStreak = m.computeStreak(
  [lastWeekWed.toISOString(), thisWeekWed.toISOString()],
  thisWeekWed
);
assert.deepStrictEqual(twoWeekStreak, { streakWeeks: 2, streakAtRisk: false, streakResetsInDays: 0 });

// Only last week active, 'now' is this week -> at risk, resets before next Monday.
const atRisk = m.computeStreak([lastWeekWed.toISOString()], thisWeekWed);
assert.strictEqual(atRisk.streakWeeks, 1);
assert.strictEqual(atRisk.streakAtRisk, true);
assert.ok(atRisk.streakResetsInDays >= 1 && atRisk.streakResetsInDays <= 7);

console.log('All matchmakerScore assertions passed.');
"
rm -rf "$tmpdir"
```

Expected output: `All matchmakerScore assertions passed.` with no assertion errors.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (the file has no external I/O, only imports types from `mockProfile.ts` which already exports them).

- [ ] **Step 4: Commit**

```bash
git add lib/matchmakerScore.ts
git commit -m "feat: add pure matchmaker score/rank/badge/streak formulas"
```

---

### Task 2: `components/intros/mockLeaderboard.ts` — real-data-ready types

**Files:**
- Modify: `components/intros/mockLeaderboard.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces (used by Task 5 and Task 6): `LeaderboardEntry` (now with optional `introsSent`), `rankedLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[]` with a deterministic tie-break.

- [ ] **Step 1: Replace the file contents**

Current file (`components/intros/mockLeaderboard.ts`) has `MOCK_LEADERBOARD` and a two-argument-free sort. Replace the whole file with:

```ts
export interface LeaderboardEntry {
  id: string;
  name: string;
  avatarUri?: string;
  // matchmaker_stats.intros_accepted — an aggregate count only. Ranking on
  // this (not intros_sent) avoids rewarding someone for spamming their
  // 3-pending-intro cap with intros that never land.
  introsAccepted: number;
  // Only used as a tie-break below, never rendered.
  introsSent?: number;
  isCurrentUser?: boolean;
}

export function rankedLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort(
    (a, b) =>
      b.introsAccepted - a.introsAccepted ||
      (b.introsSent ?? 0) - (a.introsSent ?? 0) ||
      a.id.localeCompare(b.id)
  );
}
```

- [ ] **Step 2: Confirm no remaining references to the deleted `MOCK_LEADERBOARD` export**

Run: `grep -rn "MOCK_LEADERBOARD" --include="*.ts" --include="*.tsx" .`
Expected: one match, in `app/(tabs)/intros.tsx` — that import is fixed in Task 5. If Task 5 hasn't run yet, this is expected and fine; re-run this same grep after Task 5 to confirm zero matches.

- [ ] **Step 3: Commit**

```bash
git add components/intros/mockLeaderboard.ts
git commit -m "refactor: make LeaderboardEntry real-data-ready with deterministic ranking"
```

---

### Task 3: `supabase/functions/matchmaker-leaderboard/index.ts` — new Edge Function

**Files:**
- Create: `supabase/functions/matchmaker-leaderboard/index.ts`

**Interfaces:**
- Consumes: `createAdminClient` from `../_shared/adminClient.ts`, `getCallerId`/`UnauthorizedError` from `../_shared/verifyCaller.ts`, `getDirectFriendIds` from `../_shared/friendGraph.ts` (all already exist, unmodified).
- Produces (used by Task 4): an HTTP endpoint invoked as `"matchmaker-leaderboard"` returning `{ entries: { id: string; name: string; avatarUri?: string; introsSent: number; introsAccepted: number }[] }` on 200, or `{ error: string }` on 401/500.

- [ ] **Step 1: Write the implementation**

```ts
// supabase/functions/matchmaker-leaderboard/index.ts
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
      admin
        .from("introductions")
        .select("matchmaker_id, status")
        .in("matchmaker_id", ids)
        .neq("status", "withdrawn"),
      admin.from("users").select("id, name, photos").in("id", ids),
    ]);
    if (introsResult.error) throw introsResult.error;
    if (usersResult.error) throw usersResult.error;

    const statsById = new Map<string, { introsSent: number; introsAccepted: number }>();
    for (const id of ids) statsById.set(id, { introsSent: 0, introsAccepted: 0 });
    for (const row of introsResult.data ?? []) {
      const stats = statsById.get(row.matchmaker_id);
      if (!stats) continue;
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

- [ ] **Step 2: Structural parity check against `discover-people/index.ts`**

Run: `diff <(grep -c "getCallerId\|createAdminClient\|UnauthorizedError" supabase/functions/discover-people/index.ts) <(grep -c "getCallerId\|createAdminClient\|UnauthorizedError" supabase/functions/matchmaker-leaderboard/index.ts)`

Expected: both counts equal (both files use each shared helper the same number of times) — this environment has no Supabase CLI/Docker to actually invoke the function, so structural parity with an already-deployed, already-working function is the verification available here.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/matchmaker-leaderboard/index.ts
git commit -m "feat: add matchmaker-leaderboard Edge Function"
```

**Note for the user:** this function needs to be deployed the same way `discover-people`/`discover-person` were (this environment cannot run `supabase functions deploy`).

---

### Task 4: `lib/introductions.ts` — leaderboard stats wrapper

**Files:**
- Modify: `lib/introductions.ts:132-163` (immediately after the existing `getMatchmakerStats` function, before `fetchIncomingIntroRows`)

**Interfaces:**
- Consumes: `supabase` client (already imported at the top of the file).
- Produces (used by Tasks 5 and 6): `LeaderboardStatsEntry` type, `getMatchmakerLeaderboardStats(): Promise<LeaderboardStatsEntry[]>`.

- [ ] **Step 1: Add the type and function**

Insert immediately after the closing brace of `getMatchmakerStats` (after the line `}` that follows `return { introsSent: sentResult.count ?? 0, introsAccepted: acceptedResult.count ?? 0 };` — i.e. right before the `/**\n * respond-to-introduction's state machine...` comment that precedes `fetchIncomingIntroRows`):

```ts
export interface LeaderboardStatsEntry {
  id: string;
  name: string;
  avatarUri?: string;
  introsSent: number;
  introsAccepted: number;
}

/**
 * Friend-group leaderboard stats (self + direct friends). RLS blocks a
 * client-side read of another user's introductions rows, so this goes
 * through the matchmaker-leaderboard Edge Function (admin client, same
 * pattern as discover-people/discover-person) rather than a direct query.
 */
export async function getMatchmakerLeaderboardStats(): Promise<LeaderboardStatsEntry[]> {
  const { data, error } = await supabase.functions.invoke<{ entries: LeaderboardStatsEntry[] }>(
    "matchmaker-leaderboard"
  );
  if (error) throw error;
  return data?.entries ?? [];
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/introductions.ts
git commit -m "feat: add getMatchmakerLeaderboardStats wrapper"
```

---

### Task 5: `app/(tabs)/intros.tsx` — real leaderboard entries

**Files:**
- Modify: `app/(tabs)/intros.tsx`

**Interfaces:**
- Consumes: `getMatchmakerLeaderboardStats` from `../../lib/introductions` (Task 4), `type LeaderboardEntry` from `../../components/intros/mockLeaderboard` (Task 2).
- Produces: nothing consumed by later tasks (leaf screen change).

- [ ] **Step 1: Update imports**

Replace:
```ts
import { getSentIntroductions, nudgeIntroduction, withdrawIntroduction } from "../../lib/introductions";
import { useAuthStore } from "../../store/auth";
import { MOCK_LEADERBOARD } from "../../components/intros/mockLeaderboard";
```
with:
```ts
import {
  getMatchmakerLeaderboardStats,
  getSentIntroductions,
  nudgeIntroduction,
  withdrawIntroduction,
} from "../../lib/introductions";
import { useAuthStore } from "../../store/auth";
import type { LeaderboardEntry } from "../../components/intros/mockLeaderboard";
```

- [ ] **Step 2: Add the leaderboard query and mapped entries**

After the existing block:
```ts
  const { data: sentIntros = [] } = useQuery({
    queryKey,
    queryFn: () => getSentIntroductions(userId!),
    enabled: !!userId,
  });
  const hasSentIntros = sentIntros.length > 0;
```
add:
```ts
  const { data: leaderboardStats = [] } = useQuery({
    queryKey: ["matchmakerLeaderboard", userId],
    queryFn: getMatchmakerLeaderboardStats,
    enabled: !!userId && hasSentIntros,
  });
  const leaderboardEntries: LeaderboardEntry[] = leaderboardStats.map((entry) => ({
    id: entry.id,
    name: entry.name,
    avatarUri: entry.avatarUri,
    introsAccepted: entry.introsAccepted,
    introsSent: entry.introsSent,
    isCurrentUser: entry.id === userId,
  }));
```

- [ ] **Step 3: Use the real entries**

Replace:
```tsx
        {hasSentIntros && <MatchmakerLeaderboardCard entries={MOCK_LEADERBOARD} />}
```
with:
```tsx
        {hasSentIntros && <MatchmakerLeaderboardCard entries={leaderboardEntries} />}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Confirm no remaining references to `MOCK_LEADERBOARD`**

Run: `grep -rn "MOCK_LEADERBOARD" --include="*.ts" --include="*.tsx" .`
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/intros.tsx"
git commit -m "feat: wire Intros tab leaderboard to real matchmaker-leaderboard data"
```

---

### Task 6: `app/(tabs)/profile.tsx` — real score/percentile/badges/rank/streak

**Files:**
- Modify: `app/(tabs)/profile.tsx`

**Interfaces:**
- Consumes: `computeMatchmakerScore`, `computeNextMilestoneCopy`, `computePercentileLabel`, `computeBadges`, `computeRankLevel`, `computeStreak` from `../../lib/matchmakerScore` (Task 1); `getMatchmakerLeaderboardStats` from `../../lib/introductions` (Task 4); `rankedLeaderboard` from `../../components/intros/mockLeaderboard` (Task 2).
- Produces: nothing consumed by later tasks (leaf screen change).

- [ ] **Step 1: Update imports**

Replace:
```ts
import { getUserProfile, uploadProfilePhoto, upsertUserProfile } from "../../lib/supabase";
import { getMatchmakerStats } from "../../lib/introductions";
import { getIntroducersCount } from "../../lib/friendships";
```
with:
```ts
import { getUserProfile, uploadProfilePhoto, upsertUserProfile } from "../../lib/supabase";
import { getMatchmakerLeaderboardStats, getMatchmakerStats } from "../../lib/introductions";
import { getIntroducersCount } from "../../lib/friendships";
import { rankedLeaderboard } from "../../components/intros/mockLeaderboard";
import {
  computeBadges,
  computeMatchmakerScore,
  computeNextMilestoneCopy,
  computePercentileLabel,
  computeRankLevel,
  computeStreak,
} from "../../lib/matchmakerScore";
```

Also remove `MOCK_BADGES`, `MOCK_MATCHMAKER_STATS`, `MOCK_NEXT_MILESTONE_COPY`, and `MOCK_RANK_PROGRESS` from the `mockProfile` import block (they'll no longer exist after Task 7):
```ts
import {
  MOCK_BLOCKED_COUNT,
  MOCK_PHOTOS,
  MOCK_PRIVACY_SETTINGS,
  MOCK_PROFILE_USER,
  MOCK_PROMPTS,
} from "../../components/profile/mockProfile";
```

- [ ] **Step 2: Add the leaderboard query and derived values**

After the existing block:
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
add:
```ts
  const { data: leaderboardStats = [] } = useQuery({
    queryKey: ["matchmakerLeaderboard", userId],
    queryFn: getMatchmakerLeaderboardStats,
    enabled: !!userId,
  });
  const ranked = rankedLeaderboard(
    leaderboardStats.map((entry) => ({ ...entry, isCurrentUser: entry.id === userId }))
  );
  const rank = ranked.findIndex((entry) => entry.isCurrentUser) + 1;
  const groupSize = ranked.length;

  const introsSent = matchmakerStats?.introsSent ?? 0;
  const introsAccepted = matchmakerStats?.introsAccepted ?? 0;
  const score = computeMatchmakerScore(introsSent, introsAccepted);
  const percentileLabel = computePercentileLabel(rank, groupSize);
  const badges = computeBadges(introsSent, introsAccepted, rank, groupSize);
  const nextMilestoneCopy = computeNextMilestoneCopy(introsAccepted);
  const rankProgress = {
    ...computeRankLevel(introsSent, introsAccepted),
    ...computeStreak(sentIntros.map((intro) => intro.sentAt)),
  };
```

Note: `rank` is always ≥ 1 because the Edge Function always includes the caller's own id in `ids`, so `ranked.findIndex` never returns `-1` here.

- [ ] **Step 3: Use the real values in `MatchmakerPanel`**

Replace:
```tsx
            <MatchmakerPanel
              score={MOCK_MATCHMAKER_STATS.score}
              percentileLabel={MOCK_MATCHMAKER_STATS.percentileLabel}
              introsSent={matchmakerStats?.introsSent ?? 0}
              introsAccepted={matchmakerStats?.introsAccepted ?? 0}
              hasSentIntros={(matchmakerStats?.introsSent ?? 0) > 0}
              badges={MOCK_BADGES}
              rankProgress={MOCK_RANK_PROGRESS}
              nextMilestoneCopy={MOCK_NEXT_MILESTONE_COPY}
              pendingIntro={pendingIntro}
              onMakeIntroPress={() => comingSoon("Matchmaker")}
            />
```
with:
```tsx
            <MatchmakerPanel
              score={score}
              percentileLabel={percentileLabel}
              introsSent={introsSent}
              introsAccepted={introsAccepted}
              hasSentIntros={introsSent > 0}
              badges={badges}
              rankProgress={rankProgress}
              nextMilestoneCopy={nextMilestoneCopy}
              pendingIntro={pendingIntro}
              onMakeIntroPress={() => comingSoon("Matchmaker")}
            />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. Step 1 already removed the `MOCK_BADGES`/`MOCK_MATCHMAKER_STATS`/`MOCK_NEXT_MILESTONE_COPY`/`MOCK_RANK_PROGRESS` imports from this file, so this passes regardless of whether Task 7 (which deletes those exports from `mockProfile.ts` itself) has run yet.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/profile.tsx"
git commit -m "feat: wire Matchmaker tab score/rank/badges/streak to real data"
```

---

### Task 7: `components/profile/mockProfile.ts` — remove dead mock exports

**Files:**
- Modify: `components/profile/mockProfile.ts:66-107`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing (this is cleanup only; `MatchmakerBadge` and `MatchmakerRankProgress` type exports are kept since Task 1/6 still import them).

- [ ] **Step 1: Delete the four dead exports**

Delete these four blocks from `components/profile/mockProfile.ts` (lines 66-107 in the current file):

```ts
// TODO: replace with a real progression formula — see docs/superpowers/specs
// /2026-07-15-profile-matchmaker-counts-design.md. introsSent/introsAccepted
// are real now (lib/introductions.ts's getMatchmakerStats).
export const MOCK_MATCHMAKER_STATS = {
  score: 82,
  percentileLabel: "You're in the top 15% of matchmakers this month.",
};
```
```ts
// TODO: replace with a real progression table once server-side rank/XP/streak
// tracking exists. tier/level/xp/streak are independent mock fields for now —
// not derived from `score` by any formula.
export const MOCK_RANK_PROGRESS: MatchmakerRankProgress = {
  tier: "Cupid",
  level: 4,
  xpCurrent: 340,
  xpForNextLevel: 500,
  streakWeeks: 3,
  streakAtRisk: true,
  streakResetsInDays: 1,
};
```
```ts
// TODO: replace once real progression math exists server-side. Precomputed
// nudge copy, not derived from a formula — same convention as score/
// percentileLabel above.
export const MOCK_NEXT_MILESTONE_COPY = "2 more intros to reach 100";
```
```ts
// TODO: derive from thresholds against `matchmaker_stats` once that table is real.
export const MOCK_BADGES: MatchmakerBadge[] = [
  { id: "1", label: "Top Matchmaker", tone: "butter", variant: "outline" },
  { id: "2", label: "5 Intros Sent", tone: "plum", variant: "outline" },
  { id: "3", label: "3 Matches Made", tone: "mint", variant: "outline" },
];
```

Keep the `MatchmakerBadge` and `MatchmakerRankProgress` interface declarations directly above where `MOCK_RANK_PROGRESS` used to be — only the mock *values* are deleted, not the types.

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors. This confirms Task 6's import cleanup (Step 1) and this deletion are consistent — if any file still imports `MOCK_MATCHMAKER_STATS`/`MOCK_RANK_PROGRESS`/`MOCK_NEXT_MILESTONE_COPY`/`MOCK_BADGES`, this will fail with a missing-export error.

- [ ] **Step 3: Confirm no remaining references anywhere**

Run: `grep -rn "MOCK_MATCHMAKER_STATS\|MOCK_RANK_PROGRESS\|MOCK_NEXT_MILESTONE_COPY\|MOCK_BADGES" --include="*.ts" --include="*.tsx" .`
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add components/profile/mockProfile.ts
git commit -m "chore: remove dead matchmaker score/rank/badge mocks"
```

---

### Task 8: Full project verification + CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md` (the `/lib` and file-structure sections, plus the "Supabase Tables" gap note about `matchmaker_stats`)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing (documentation + final check only).

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full dead-mock grep across the whole repo**

Run: `grep -rn "MOCK_LEADERBOARD\|MOCK_MATCHMAKER_STATS\|MOCK_RANK_PROGRESS\|MOCK_NEXT_MILESTONE_COPY\|MOCK_BADGES" --include="*.ts" --include="*.tsx" .`
Expected: no matches.

- [ ] **Step 3: Update `CLAUDE.md`**

In the `/lib` file-structure table, add an entry for the new file and extend the `introductions.ts` entry, matching this repo's existing convention of describing what's real vs. mock inline:

```
  matchmakerScore.ts   — pure functions (no I/O): `computeMatchmakerScore`, `computeNextMilestoneCopy`, `computePercentileLabel`, `computeBadges`, `computeRankLevel`, `computeStreak` — turn `getMatchmakerStats` counts + `getMatchmakerLeaderboardStats` rank into the Matchmaker tab's score/badges/tier/level/streak; formulas are a first-pass (score weights, 150-XP/level, badge thresholds), isolated here for easy tuning
```

Append to the existing `introductions.ts` line: `getMatchmakerLeaderboardStats` (self + direct friends' `introsSent`/`introsAccepted` via the `matchmaker-leaderboard` Edge Function — RLS blocks a client-side cross-user `introductions` read, same reason `discover-people`/`discover-person` exist).

Update the "No `matchmaker_stats` table" sentence in the Supabase Tables section to note the leaderboard/score/badges are now also live-computed (not just introsSent/introsAccepted), and mention the `matchmaker-leaderboard` Edge Function alongside the other four in the Edge Functions list (if CLAUDE.md enumerates them — check the current file for where `discover-people`/`discover-person` are listed and add `matchmaker-leaderboard` there in the same style).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for real matchmaker score/rank/leaderboard data"
```

---

## Manual Verification (post-implementation, requires a deployed Edge Function)

Once `matchmaker-leaderboard` is deployed (outside this environment's capability):

1. Zero-friends account: leaderboard Edge Function returns a 1-entry list (self only) → `groupSize = 1` → percentile label falls back to "Invite friends…", no "Top Matchmaker" badge.
2. Multi-friend group with varying accepted counts: confirm the leaderboard modal ranks correctly, the collapsed card's `currentUserRank` matches the modal's row order, and the profile tab's percentile matches that same rank.
3. Send 5 intros (no acceptances yet): "5 Intros Sent" badge appears, "3 Matches Made" doesn't, score reflects `introsSent * 3`.
4. Accept 3 of them: "3 Matches Made" appears, score jumps by `introsAccepted * 15`.
5. Streak: hand-insert (SQL Editor) an `introductions` row with `created_at` backdated to last week and one to this week for the same matchmaker; confirm `streakWeeks = 2`, `streakAtRisk = false`. Remove this week's row; confirm `streakAtRisk = true` and `streakResetsInDays` matches days left until next Monday.
6. Level/tier: confirm `Lvl N` and tier name on the score-ring flip side change as `introsSent`/`introsAccepted` cross the 150-XP-per-level boundaries.
