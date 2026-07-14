# Wingman-Only Home Screen (Daily Prompt Card) — Design

## Problem

The Home screen (`app/(tabs)/index.tsx`) shows the same layout to every user:
`HomeHeader` → `IntroFeed` (incoming intros) → `FriendsRow`. For a user who
signed up purely to matchmake ("I'll wing somebody" at onboarding), an
incoming-intros feed is irrelevant — they have nothing incoming. There's
currently no persisted signal for which onboarding path a user took, so the
home screen can't branch at all.

## Role Persistence (prerequisite)

The `intent` choice on `app/(auth)/intent.tsx` (`"wing-me" | "wing-somebody"`,
type `OnboardingIntent`) is currently only passed as a route param into
`onboarding.tsx`, where it's used solely to pick the photos-step headline
copy, then discarded.

- Add a `role` column to the `users` table: `text`, values `"wing-me"` /
  `"wing-somebody"` (reuses the existing `OnboardingIntent` string values
  directly — no translation layer).
- `onboarding.tsx`'s `handleNameContinue` saves `role: intent` in the same
  `upsertUserProfile` call that already saves `name`.
- `lib/supabase.ts`: add `role: string | null` to `UserProfileRow`, add
  `role` to `getUserProfile`'s `.select()`, add `role` to
  `upsertUserProfile`'s `fields` type.
- Home screen treats missing/null `role` (pre-existing users, or onboarding
  reached without an `intent` param) as `"wing-me"` — the existing behavior
  is the safe default.

## Prompts Data Model

Defined as a typed fixture (`lib/prompts.ts`), matching the existing
`MOCK_MATCHMAKER_FRIENDS` / `MOCK_FRIEND_PROFILES` convention rather than a
live Supabase table — every adjacent system (friends, matchmaker friends,
intros, chats) is still mock data pending a future backend-wiring pass, and
`users` is the only table actually live today.

```ts
export interface Prompt {
  id: string;
  text: string;
  keywords: string[];
}

export const PROMPTS: Prompt[] = [ /* 20-30 hand-written entries */ ];
```

- Hand-written, in Wing's warm/candid/cheeky voice (e.g. "Who's the funniest
  single friend you know?" / "Which one of your friends gives the best
  relationship advice they never take themselves?"). Not AI-generated — same
  rule as intro notes.
- `keywords` are lowercase, single or short multi-word phrases used for
  substring-free, whole-word matching against friend bio prompts (e.g.
  `["coffee", "outdoorsy", "trivia"]`).

**Deterministic daily selection:**

```ts
export function getTodaysPrompt(date: Date = new Date()): Prompt {
  const dayOfYear = /* days since Jan 1 of date's year, 0-indexed */;
  return PROMPTS[dayOfYear % PROMPTS.length];
}
```

No stored rotation state, no per-user variation — same prompt for every
wingman-role user on a given calendar day.

## Friend List for the Prompt

`MOCK_MATCHMAKER_FRIENDS` has `canIntroduce` but no bio prompts;
`MOCK_FRIEND_PROFILES` has `prompts` (their bio Q&A) but no `canIntroduce`.
Both are already keyed by the same ids (per existing code comments). Add a
join helper:

```ts
// components/matchmaker/mockMatchmakerFriends.ts (or a new small module)
export function getIntroducibleFriends(): MatchmakerFriend[] {
  return MOCK_MATCHMAKER_FRIENDS.filter((f) => f.canIntroduce);
}
```

Bio prompt text lookup happens in the matching function itself (joins to
`MOCK_FRIEND_PROFILES[friend.id].prompts` by id).

**Keyword-overlap reordering** (`lib/promptMatch.ts`):

```ts
export function sortFriendsByPromptMatch(
  friends: MatchmakerFriend[],
  keywords: string[]
): MatchmakerFriend[]
```

- For each friend, concatenate `question + " " + answer` across all their
  `bio_prompts` entries (from `MOCK_FRIEND_PROFILES`).
- A friend "matches" if any prompt keyword appears as a whole-word,
  case-insensitive match (`\bkeyword\b` regex) in that concatenated text.
- Stable sort: matches first, non-matches after. Within each group, original
  order is preserved (JS `Array.prototype.sort` is stable). No score, no
  visible match count/badge.
- Never filters — if zero friends match, the same full list returns,
  unordered (original order).

## Components

### `components/home/PromptCard.tsx`

Visually mirrors `IntroNoteCard` (sunset gradient, `xl` radius, DM Mono
uppercase eyebrow, Bricolage Grotesque bold body):

- Eyebrow: **"TODAY'S PROMPT"**.
- Body: the day's `Prompt.text`.
- Two states:
  - **Normal** (2+ introducible friends): tappable, opens the friend list
    (see below). Card-press micro-interaction matches existing card
    convention (scale 0.98, 120ms).
  - **Locked** (0-1 introducible friends): visually dimmed/lock affordance
    instead of the normal tap hint. Tap calls the existing
    `comingSoon("Friend visibility settings")` stub (same `Alert.alert`
    convention already used by `PrivacyPanel`'s `onVisibilityPress` in
    `app/(tabs)/profile.tsx`) — never a dead tap, and consistent with the
    rest of the app since a real Friend Visibility Settings screen doesn't
    exist yet either.

### `app/matchmaker/prompt-friends.tsx` (new modal screen)

Chrome copied from `app/matchmaker/select.tsx` (rounded top `2xl` corners,
drag handle, X close, `insets.top` padding). Content:

- Heading references the day's prompt (e.g. shows the prompt text or a
  short header — exact copy decided during implementation, matching
  existing heading/caption style pairs).
- Single-select vertical list of `getIntroducibleFriends()`, reordered by
  `sortFriendsByPromptMatch`. Each row: avatar + name (no match
  badge/indicator — reordering only, per the "no new tags" constraint).
- Row tap: `Haptics.impactAsync(Light)` then
  `router.push(`/matchmaker/select?preselect=${friendId}`)`.
- Reuses the **existing** preselect mechanism in `select.tsx`
  (`getFriendEligibility(preselectedFriend) !== "eligible"` → silently
  falls back to no selection) — same behavior already relied on by Friend
  Profile's "Introduce" button. No new eligibility logic needed here; a
  `canIntroduce: true` friend who happens to be `not_looking` or `at_cap`
  today will land on Step 1 with nothing preselected, identical to the
  existing Friend Profile entry point.

## Home Screen (`app/(tabs)/index.tsx`)

```ts
const isWingman = profile?.role === "wing-somebody";
```

- `isWingman === true`: render `<PromptCard />` in place of
  `<IntroFeed intros={MOCK_INTROS} />`.
- `isWingman === false` (including `role` null/undefined/`"wing-me"`):
  render `IntroFeed` exactly as today — no changes to that code path.
- `HomeHeader` and `FriendsRow` render unchanged in both branches.
- FAB (make-an-intro) is unaffected in both branches — always available,
  never gated by the prompt.

## Edge Cases

- 0-1 introducible friends → `PromptCard` locked state, never opens an
  empty friend list.
- Missing/null `role` → treated as `wing-me`, existing feed shown.
- Zero keyword matches for the day's prompt → friend list still opens,
  unordered, never an empty state.
- 3-active-pending-intro cap → already enforced in `matchmaker/note.tsx`
  (Step 2), unchanged, applies identically regardless of entry point.

## Out of Scope

- AI-generated or per-user-personalized prompts.
- Pre-computed friend *pairs* — only individual friend filtering/reordering;
  pairing still happens through the unchanged two-step matchmaker flow.
- Any new tags/interests field — matching uses existing `bio_prompts` text
  only.
- Stats/leaderboard for prompt engagement.
- A real Friend Visibility Settings screen (still a `comingSoon` stub
  elsewhere in the app too).
- Per-user prompt rotation or history (e.g. "don't repeat prompts I've
  seen") — one global prompt per day, full stop.

## Testing

- Typecheck passes.
- Manual verification via the running Expo dev server:
  - A `role: "wing-somebody"` profile sees `PromptCard` instead of
    `IntroFeed`; `FriendsRow` and FAB unchanged.
  - A `role: "wing-me"` (or null) profile sees the existing `IntroFeed`
    unchanged.
  - Tapping the normal-state `PromptCard` opens the friend list, reordered
    so any friend whose bio prompts match today's keywords appear first.
  - Tapping a friend row lands on Matchmaker Step 1 with that friend
    preselected as person A; continuing through Step 2 (note + send) is
    unchanged.
  - Temporarily reducing introducible friends to 0-1 shows the locked
    `PromptCard` state; tapping it shows the "Friend visibility settings"
    coming-soon alert instead of opening an empty list.
