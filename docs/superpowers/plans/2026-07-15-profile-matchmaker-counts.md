# Profile Matchmaker Counts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Profile screen's Matchmaker/Privacy tabs (`app/(tabs)/profile.tsx`) to real `introsSent`, `introsAccepted`, `hasSentIntros`, and `introducersCount` values instead of `components/profile/mockProfile.ts` constants.

**Architecture:** Two new read-only query functions — `getMatchmakerStats` in `lib/introductions.ts` (counts against `introductions`) and `getIntroducersCount` in `lib/friendships.ts` (count against `friendships`) — both using Supabase's `count: "exact", head: true` mode so no rows are transferred, just counts. No new tables, no RLS changes (existing `introductions_select_participant` / `friendships_select_participant` policies already cover a user reading rows where they're `matchmaker_id` / `user_id`). `profile.tsx` consumes both via React Query, replacing the mock constants it currently imports for those four values. Score/percentile/rank/badges/leaderboard are unaffected — still mock, per the approved spec.

**Tech Stack:** TypeScript (strict), Supabase JS client, React Query (`@tanstack/react-query`). No test framework exists in this repo (verified: no jest config, no `*.test.*` files, `package.json` has no `test` script) — verification is `tsc --noEmit` plus manual app run, matching how the Chats/Intros Supabase wiring shipped.

## Global Constraints

- TypeScript strict mode always on — every new function must fully type its params and return value.
- No new Supabase tables/migrations — spec explicitly rejects creating `matchmaker_stats`.
- `status` on `introductions` must never be exposed beyond aggregate counts to the matchmaker (matchmaker-firewall rule) — these functions return counts only, never raw status per intro.
- Keep files under 500 lines.
- Do not add automated tests where none of this project's precedent (chat/intros data wiring) added any — verify via typecheck + manual run instead.

---

### Task 1: `getMatchmakerStats` in `lib/introductions.ts`

**Files:**
- Modify: `lib/introductions.ts` (append after `getSentIntroductions`, currently ending at line 128)

**Interfaces:**
- Consumes: `supabase` client from `./supabase` (already imported at top of file)
- Produces: `export interface MatchmakerStats { introsSent: number; introsAccepted: number }` and `export async function getMatchmakerStats(matchmakerId: string): Promise<MatchmakerStats>` — Task 3 imports both.

- [ ] **Step 1: Append the function**

Add to the end of `lib/introductions.ts` (after the closing `}` of `getSentIntroductions` on line 128):

```ts

export interface MatchmakerStats {
  introsSent: number;
  introsAccepted: number;
}

/**
 * Aggregate counts only, per the matchmaker-firewall privacy rule — no
 * status or chat data leaves this function, just two numbers. introsSent
 * excludes withdrawn, matching getSentIntroductions' convention (a
 * withdrawn intro was never "sent").
 */
export async function getMatchmakerStats(matchmakerId: string): Promise<MatchmakerStats> {
  const [sentResult, acceptedResult] = await Promise.all([
    supabase
      .from("introductions")
      .select("id", { count: "exact", head: true })
      .eq("matchmaker_id", matchmakerId)
      .neq("status", "withdrawn"),
    supabase
      .from("introductions")
      .select("id", { count: "exact", head: true })
      .eq("matchmaker_id", matchmakerId)
      .eq("status", "accepted"),
  ]);
  if (sentResult.error) throw sentResult.error;
  if (acceptedResult.error) throw acceptedResult.error;

  return {
    introsSent: sentResult.count ?? 0,
    introsAccepted: acceptedResult.count ?? 0,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `lib/introductions.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/introductions.ts
git commit -m "feat: add getMatchmakerStats for real intro count queries"
```

---

### Task 2: `getIntroducersCount` in `lib/friendships.ts`

**Files:**
- Modify: `lib/friendships.ts` (append after `getMatchmakerFriends`)

**Interfaces:**
- Consumes: `supabase` client from `./supabase` (already imported at top of file)
- Produces: `export async function getIntroducersCount(userId: string): Promise<number>` — Task 3 imports this.

- [ ] **Step 1: Append the function**

Add to the end of `lib/friendships.ts`:

```ts

/**
 * Count of friends who can introduce this user. A friendships row's
 * user_id is the friend who granted permission, friend_id is the person
 * allowed to introduce them (see getMatchmakerFriends above) — so rows
 * where user_id = userId are the ones this user granted, and counting
 * those with can_introduce = true gives the number of friends allowed to
 * introduce this user.
 */
export async function getIntroducersCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("friendships")
    .select("friend_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("can_introduce", true);
  if (error) throw error;
  return count ?? 0;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `lib/friendships.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/friendships.ts
git commit -m "feat: add getIntroducersCount for real friend-permission counts"
```

---

### Task 3: Wire `profile.tsx` to real counts and clean up `mockProfile.ts`

**Files:**
- Modify: `app/(tabs)/profile.tsx`
- Modify: `components/profile/mockProfile.ts`

**Interfaces:**
- Consumes: `getMatchmakerStats(matchmakerId: string): Promise<MatchmakerStats>` from Task 1, `getIntroducersCount(userId: string): Promise<number>` from Task 2.
- Produces: nothing further consumed by other tasks (this is the last task).

- [ ] **Step 1: Update imports in `app/(tabs)/profile.tsx`**

Current import block (around line 21):

```ts
import { getUserProfile, uploadProfilePhoto, upsertUserProfile } from "../../lib/supabase";
```

Add a new import right after it:

```ts
import { getMatchmakerStats } from "../../lib/introductions";
import { getIntroducersCount } from "../../lib/friendships";
```

Then update the existing mock import block (currently lines 30-41):

```ts
import {
  MOCK_BADGES,
  MOCK_BLOCKED_COUNT,
  MOCK_HAS_SENT_INTROS,
  MOCK_INTRODUCERS_COUNT,
  MOCK_MATCHMAKER_STATS,
  MOCK_NEXT_MILESTONE_COPY,
  MOCK_PHOTOS,
  MOCK_PRIVACY_SETTINGS,
  MOCK_PROFILE_USER,
  MOCK_PROMPTS,
  MOCK_RANK_PROGRESS,
} from "../../components/profile/mockProfile";
```

to remove `MOCK_HAS_SENT_INTROS` and `MOCK_INTRODUCERS_COUNT` (both are being replaced by real data in this task):

```ts
import {
  MOCK_BADGES,
  MOCK_BLOCKED_COUNT,
  MOCK_MATCHMAKER_STATS,
  MOCK_NEXT_MILESTONE_COPY,
  MOCK_PHOTOS,
  MOCK_PRIVACY_SETTINGS,
  MOCK_PROFILE_USER,
  MOCK_PROMPTS,
  MOCK_RANK_PROGRESS,
} from "../../components/profile/mockProfile";
```

- [ ] **Step 2: Add the two queries**

The existing `sentIntros` query in `profile.tsx` currently reads:

```ts
  const { data: sentIntros = [] } = useQuery({
    queryKey: ["sentIntroductions", userId],
    queryFn: () => getSentIntroductions(userId!),
    enabled: !!userId,
  });
  const pendingIntro = sentIntros.find((intro) => intro.status === "pending");
```

Add the two new queries directly after it:

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

- [ ] **Step 3: Replace the mock values passed to `MatchmakerPanel` and `PrivacyPanel`**

Current `MatchmakerPanel` usage:

```tsx
            <MatchmakerPanel
              score={MOCK_MATCHMAKER_STATS.score}
              percentileLabel={MOCK_MATCHMAKER_STATS.percentileLabel}
              introsSent={MOCK_MATCHMAKER_STATS.introsSent}
              introsAccepted={MOCK_MATCHMAKER_STATS.introsAccepted}
              hasSentIntros={MOCK_HAS_SENT_INTROS}
              badges={MOCK_BADGES}
              rankProgress={MOCK_RANK_PROGRESS}
              nextMilestoneCopy={MOCK_NEXT_MILESTONE_COPY}
              pendingIntro={pendingIntro}
              onMakeIntroPress={() => comingSoon("Matchmaker")}
            />
```

Replace with:

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

Current `PrivacyPanel` usage:

```tsx
            <PrivacyPanel
              introducersCount={MOCK_INTRODUCERS_COUNT}
              blockedCount={MOCK_BLOCKED_COUNT}
              settings={privacySettings}
              onSettingsChange={setPrivacySettings}
              onVisibilityPress={() => comingSoon("Friend visibility settings")}
              onBlockedListPress={() => comingSoon("Blocked & hidden")}
              onAccountSettingsPress={() => comingSoon("Account settings")}
            />
```

Replace `introducersCount={MOCK_INTRODUCERS_COUNT}` with:

```tsx
              introducersCount={introducersCount ?? 0}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. In particular no "declared but never used" errors for `MOCK_HAS_SENT_INTROS`/`MOCK_INTRODUCERS_COUNT` (they must be fully removed from the import, not just unused).

- [ ] **Step 5: Clean up `components/profile/mockProfile.ts`**

Current (around line 66):

```ts
// TODO: replace with a real `matchmaker_stats` row for the signed-in user.
export const MOCK_MATCHMAKER_STATS = {
  score: 82,
  percentileLabel: "You're in the top 15% of matchmakers this month.",
  introsSent: 6,
  introsAccepted: 4,
};
```

Replace with (drop the now-real fields, update the comment):

```ts
// TODO: replace with a real progression formula — see docs/superpowers/specs
// /2026-07-15-profile-matchmaker-counts-design.md. introsSent/introsAccepted
// are real now (lib/introductions.ts's getMatchmakerStats).
export const MOCK_MATCHMAKER_STATS = {
  score: 82,
  percentileLabel: "You're in the top 15% of matchmakers this month.",
};
```

Current (a few lines below):

```ts
// TODO: replace with 0 sent-intros count from `matchmaker_stats` to test the empty nudge state for real.
export const MOCK_HAS_SENT_INTROS = true;
```

Delete this constant and its comment entirely (now real, derived in `profile.tsx`).

Current:

```ts
// TODO: replace with the count of friendships where can_introduce = true.
export const MOCK_INTRODUCERS_COUNT = 12;
```

Delete this constant and its comment entirely (now real, `lib/friendships.ts`'s `getIntroducersCount`).

- [ ] **Step 6: Typecheck again**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Manual verification**

Run: `npx expo start`

Sign in as a test user and navigate to the Profile tab → Matchmaker segment:
- If this user has never sent an intro, confirm the empty-nudge state ("You haven't played matchmaker yet") renders instead of the stat tiles — this is the real `hasSentIntros = false` path, replacing the old hardcoded `true` mock.
- If this user has sent at least one intro, confirm the "Intros sent" and "Accepted" stat tiles show numbers matching what's actually in the `introductions` table for that user as `matchmaker_id` (spot-check against Supabase Table Editor if needed).
- Navigate to the Privacy segment, confirm the introducers count matches the number of `friendships` rows where `user_id` = this user and `can_introduce = true`.
- Note: no iOS/Android simulator is available in this environment — if only web preview is available, be aware of known RN-web auth/preview gotchas (see project memory) and flag any check that genuinely needs a native device as still owed to the user.

- [ ] **Step 8: Commit**

```bash
git add app/\(tabs\)/profile.tsx components/profile/mockProfile.ts
git commit -m "feat: wire Profile screen matchmaker/privacy counts to real Supabase data"
```

---

## Self-Review Notes

- **Spec coverage:** `getMatchmakerStats` (Task 1) covers `introsSent`/`introsAccepted`; `getIntroducersCount` (Task 2) covers `introducersCount`; Task 3 wires all four values including derived `hasSentIntros` and does the `mockProfile.ts` cleanup the spec calls for. Score/percentile/rank/badges/leaderboard are untouched, matching the spec's explicit out-of-scope list.
- **Type consistency:** `MatchmakerStats` (Task 1) is consumed by exact field names `introsSent`/`introsAccepted` in Task 3's `matchmakerStats?.introsSent` / `matchmakerStats?.introsAccepted`. `getIntroducersCount` returns a bare `number`, consumed as `introducersCount?.number` — actually consumed directly as `introducersCount ?? 0` since the query data IS the number, no wrapper object. Verified consistent.
- **No placeholders:** all steps show complete code, no TBD/TODO-as-instruction, no "similar to Task N" shortcuts.
