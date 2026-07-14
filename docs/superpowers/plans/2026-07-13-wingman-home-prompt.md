# Wingman-Only Home Screen (Daily Prompt Card) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Home screen's intro feed with a daily Prompt Card for wingman-only users (`role: "wing-somebody"`), which opens a keyword-reordered list of the user's introducible friends and drops the selected friend into the existing Matchmaker Step 1 flow.

**Architecture:** A hand-written prompt fixture (`lib/prompts.ts`) picks one prompt per day via `dayOfYear % PROMPTS.length` — no stored rotation state. A pure keyword-matching function (`lib/promptMatch.ts`) reorders (never filters) the wingman's `canIntroduce: true` friends by whole-word overlap between the prompt's keywords and each friend's bio prompt text. The Home screen (`app/(tabs)/index.tsx`) branches on a newly-persisted `role` column on `users` to swap `IntroFeed` for `PromptCard`; everything else (`HomeHeader`, `FriendsRow`, FAB) is untouched. Tapping a friend in the new `app/matchmaker/prompt-friends.tsx` screen reuses the existing `?preselect=` mechanism already wired into `app/matchmaker/select.tsx`.

**Tech Stack:** Expo Router, React Native, TypeScript (strict), Zustand, React Query, Supabase, Reanimated, expo-haptics, expo-linear-gradient. No test runner is configured in this repo (no jest/vitest, no `*.test.ts` files anywhere) — verification follows the project's existing convention of `npm run typecheck` per change plus one consolidated manual dev-server walkthrough at the end (see every prior spec's "Testing" section, e.g. `docs/superpowers/specs/2026-07-13-friend-wingman-status-design.md`).

## Global Constraints

- Design tokens only — no magic numbers. Colors from `constants/colors.ts`, spacing from the 4px scale in `constants/spacing.ts`, radii from `constants/spacing.ts`, shadows from `constants/elevation.ts`, fonts/text styles from `constants/typography.ts`.
- Prompt Card mirrors `IntroNoteCard`: Sunset gradient (`gradients.sunset`), `radii.xl` corner radius, DM Mono uppercase eyebrow, Bricolage Grotesque bold body.
- Never style a bare `Pressable` — visuals (background, scale transform) go on an inner `View`/`Animated.View` inside the render-prop, per the existing `Button.tsx` / `IntentCard` pattern (this app's `Pressable` styles silently don't paint on-device otherwise).
- Prompts are hand-written, not AI-generated — same rule as intro notes.
- One global prompt per day, no per-user personalization or rotation history.
- The friend list reorders, never filters, by keyword match.
- Missing/null `role` defaults to existing `wing-me` behavior (safe default for pre-existing users).
- No new tags/interests field — matching uses the existing `bio_prompts`/`prompts` text only.
- No stats, leaderboard, or match-count badge anywhere in this feature.

---

### Task 1: Persist onboarding role to Supabase

**Files:**
- Modify: `lib/supabase.ts` (add `role` to `UserProfileRow`, `getUserProfile`, `upsertUserProfile`)
- Modify: `app/(auth)/onboarding.tsx` (save `role` in `handleNameContinue`)

**Interfaces:**
- Produces: `UserProfileRow.role: string | null`, consumed by `app/(tabs)/index.tsx` in Task 6.
- Produces: `upsertUserProfile(userId, { role?: string, ... })`, called from `onboarding.tsx`.

- [ ] **Step 1: Add the `role` column in Supabase**

Run this in the Supabase SQL Editor for this project (per the existing hand-run-SQL convention — there's no migrations folder in this repo):

```sql
alter table users add column if not exists role text;
```

No default, no `not null` — existing rows get `null`, which the app treats as `wing-me`.

- [ ] **Step 2: Update `lib/supabase.ts` types and functions**

Modify the file so the relevant exports read:

```ts
export async function upsertUserProfile(
  userId: string,
  fields: { name?: string; photos?: string[]; bio_prompts?: object[]; role?: string }
) {
  const { error } = await supabase
    .from("users")
    .upsert({ id: userId, ...fields }, { onConflict: "id" });
  if (error) throw error;
}

export interface BioPrompt {
  question: string;
  answer: string;
}

export interface UserProfileRow {
  name: string | null;
  photos: string[] | null;
  bio_prompts: BioPrompt[] | null;
  role: string | null;
}

export async function getUserProfile(userId: string): Promise<UserProfileRow | null> {
  const { data, error } = await supabase
    .from("users")
    .select("name, photos, bio_prompts, role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 3: Save `role` during onboarding**

In `app/(auth)/onboarding.tsx`, import the intent type and derive a validated role near the top of the component (next to `photosHeadline`):

```ts
import type { OnboardingIntent } from "./intent";
```

```ts
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const role: OnboardingIntent = intent === "wing-somebody" ? "wing-somebody" : "wing-me";
  const photosHeadline =
    intent === "wing-somebody"
      ? "Put a face to the matchmaker"
      : "Give your wingman something to work with";
```

Then update `handleNameContinue` to save it:

```ts
  async function handleNameContinue() {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    if (!trimmedFirst || !trimmedLast || !user?.id) return;
    setIsSavingName(true);
    try {
      await upsertUserProfile(user.id, { name: `${trimmedFirst} ${trimmedLast}`, role });
      setStep(1);
    } catch (err) {
      console.error("Failed to save name:", err);
    } finally {
      setIsSavingName(false);
    }
  }
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase.ts "app/(auth)/onboarding.tsx"
git commit -m "feat: persist onboarding role to the users table"
```

---

### Task 2: Prompt fixture and deterministic daily selection

**Files:**
- Create: `lib/prompts.ts`

**Interfaces:**
- Produces: `Prompt { id: string; text: string; keywords: string[] }`, `PROMPTS: Prompt[]`, `getTodaysPrompt(date?: Date): Prompt` — consumed by `components/home/PromptCard.tsx` (Task 4), `app/matchmaker/prompt-friends.tsx` (Task 5), and `app/(tabs)/index.tsx` (Task 6).

- [ ] **Step 1: Create the prompt bank and selector**

```ts
// lib/prompts.ts
export interface Prompt {
  id: string;
  text: string;
  keywords: string[];
}

// Hand-written, one shown per calendar day (see getTodaysPrompt below) —
// never AI-generated, same rule as intro notes. Keywords are lowercase and
// matched as whole words against friends' bio prompt text in
// lib/promptMatch.ts.
export const PROMPTS: Prompt[] = [
  { id: "1", text: "Who's the funniest single friend you know?", keywords: ["funny", "comedian", "jokes"] },
  { id: "2", text: "Which friend gives the best relationship advice they never take themselves?", keywords: ["advice", "relationship"] },
  { id: "3", text: "Who's the friend that's way too good at first dates?", keywords: ["dating", "dates"] },
  { id: "4", text: "Who do you know that's secretly a hopeless romantic?", keywords: ["romantic"] },
  { id: "5", text: "Which friend always has the best restaurant recommendations?", keywords: ["food", "restaurant", "foodie"] },
  { id: "6", text: "Who's the friend everyone agrees deserves someone great?", keywords: ["deserves"] },
  { id: "7", text: "Which friend is weirdly competitive about board games?", keywords: ["games", "competitive"] },
  { id: "8", text: "Who's your most outdoorsy single friend?", keywords: ["outdoorsy", "hiking", "outdoors", "ski"] },
  { id: "9", text: "Which friend can talk about music for hours?", keywords: ["music", "concerts"] },
  { id: "10", text: "Who's the friend that makes any road trip better?", keywords: ["road", "travel"] },
  { id: "11", text: "Which friend has the best taste in coffee shops?", keywords: ["coffee"] },
  { id: "12", text: "Who's the friend who always says yes to spontaneous plans?", keywords: ["spontaneous", "adventurous"] },
  { id: "13", text: "Which friend would absolutely crush a trivia night?", keywords: ["trivia"] },
  { id: "14", text: "Who's the friend that's a genuinely amazing cook?", keywords: ["cooking", "cook"] },
  { id: "15", text: "Which friend has the best book recommendations?", keywords: ["books", "reading"] },
  { id: "16", text: "Who's the friend who's low-key hilarious in a group chat?", keywords: ["funny", "hilarious"] },
  { id: "17", text: "Which friend is a genuinely great listener?", keywords: ["listener", "thoughtful"] },
  { id: "18", text: "Who's the friend that's always down for a workout?", keywords: ["gym", "workout", "fitness"] },
  { id: "19", text: "Which friend has surprisingly good karaoke skills?", keywords: ["karaoke", "singing"] },
  { id: "20", text: "Who's the friend that gives the warmest hugs?", keywords: ["warm", "kind"] },
  { id: "21", text: "Which friend is quietly one of the most ambitious people you know?", keywords: ["ambitious", "career"] },
  { id: "22", text: "Who's the friend who remembers literally everyone's birthday?", keywords: ["thoughtful", "birthday"] },
  { id: "23", text: "Which friend has the best pickup-game energy — pickleball, basketball, you name it?", keywords: ["pickleball", "basketball", "sports"] },
  { id: "24", text: "Who's the friend that's a total sucker for a good sunset?", keywords: ["sunset", "outdoors"] },
];

/**
 * One global prompt per calendar day — day-of-year (0-indexed, local time)
 * modulo the bank size. No stored rotation state, no per-user variation.
 */
export function getTodaysPrompt(date: Date = new Date()): Prompt {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
  return PROMPTS[dayOfYear % PROMPTS.length];
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Verify the selector by construction**

`PROMPTS.length` is 24. `getTodaysPrompt(new Date(2026, 0, 1))` → `startOfYear` equals the input date → `dayOfYear = 0` → returns `PROMPTS[0 % 24]` = `PROMPTS[0]` (the "funniest single friend" prompt). `getTodaysPrompt(new Date(2026, 0, 25))` → `dayOfYear = 24` → `PROMPTS[24 % 24]` = `PROMPTS[0]` again (confirms the wraparound). This is exercised live in Task 7.

- [ ] **Step 4: Commit**

```bash
git add lib/prompts.ts
git commit -m "feat: add hand-written prompt bank and daily selector"
```

---

### Task 3: Introducible friends + keyword-match reordering

**Files:**
- Modify: `components/matchmaker/mockMatchmakerFriends.ts` (add `getIntroducibleFriends`)
- Create: `lib/promptMatch.ts`

**Interfaces:**
- Consumes: `MatchmakerFriend { id, name, imageUri?, canIntroduce, activePendingCount, lookingToGetSetUp }` from `components/matchmaker/mockMatchmakerFriends.ts`; `FriendProfile.prompts: { question, answer }[]` from `components/friend/mockFriendProfiles.ts`.
- Produces: `getIntroducibleFriends(): MatchmakerFriend[]` (exported from `mockMatchmakerFriends.ts`); `sortFriendsByPromptMatch(friends: MatchmakerFriend[], keywords: string[]): MatchmakerFriend[]` (exported from `lib/promptMatch.ts`) — both consumed by `app/matchmaker/prompt-friends.tsx` (Task 5); `getIntroducibleFriends` also consumed by `app/(tabs)/index.tsx` (Task 6).

- [ ] **Step 1: Add the join helper to `mockMatchmakerFriends.ts`**

Append to the end of `components/matchmaker/mockMatchmakerFriends.ts`:

```ts
// The wingman's introducible friends for the daily-prompt flow — friends
// who've opted this user in to introduce them. Reordered elsewhere by
// keyword match, never filtered further here (lookingToGetSetUp / pending
// cap are re-checked downstream by getFriendEligibility when the picked
// friend lands on Matchmaker Step 1 via ?preselect=).
export function getIntroducibleFriends(): MatchmakerFriend[] {
  return MOCK_MATCHMAKER_FRIENDS.filter((friend) => friend.canIntroduce);
}
```

- [ ] **Step 2: Create `lib/promptMatch.ts`**

```ts
// lib/promptMatch.ts
import { MOCK_FRIEND_PROFILES } from "../components/friend/mockFriendProfiles";
import type { MatchmakerFriend } from "../components/matchmaker/mockMatchmakerFriends";

function friendBioText(friendId: string): string {
  const profile = MOCK_FRIEND_PROFILES[friendId];
  if (!profile) return "";
  return profile.prompts.map((p) => `${p.question} ${p.answer}`).join(" ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  return keywords.some((keyword) =>
    new RegExp(`\\b${escapeRegExp(keyword.toLowerCase())}\\b`).test(lowerText)
  );
}

/**
 * Reorders friends so any whose bio prompts match at least one keyword
 * float to the top. Never filters — every friend passed in is still
 * present in the result, just reordered. Stable: friends within the same
 * match/non-match group keep their original relative order.
 */
export function sortFriendsByPromptMatch(
  friends: MatchmakerFriend[],
  keywords: string[]
): MatchmakerFriend[] {
  return [...friends].sort((a, b) => {
    const aMatches = matchesKeywords(friendBioText(a.id), keywords);
    const bMatches = matchesKeywords(friendBioText(b.id), keywords);
    if (aMatches === bMatches) return 0;
    return aMatches ? -1 : 1;
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Verify by construction**

With `PROMPTS[22]` (id `"23"`, keywords `["pickleball", "basketball", "sports"]`) and the current `MOCK_MATCHMAKER_FRIENDS`/`MOCK_FRIEND_PROFILES` fixtures: Sam Rivera's (id `"1"`) bio answer is *"A pickup game of pickleball, any time of day."* — contains the whole word "pickleball" → matches. Theo Marsh (id `"5"`) is `canIntroduce: false` so is already excluded by `getIntroducibleFriends()`. None of the other 5 introducible friends' bios contain "pickleball", "basketball", or "sports" as whole words, so `sortFriendsByPromptMatch(getIntroducibleFriends(), PROMPTS[22].keywords)` should return Sam Rivera first, the other 5 following in their original array order. This is exercised live in Task 7.

- [ ] **Step 5: Commit**

```bash
git add components/matchmaker/mockMatchmakerFriends.ts lib/promptMatch.ts
git commit -m "feat: add introducible-friends join and keyword-match reordering"
```

---

### Task 4: PromptCard component

**Files:**
- Create: `components/home/PromptCard.tsx`

**Interfaces:**
- Consumes: `Prompt` from `lib/prompts.ts` (Task 2).
- Produces: `PromptCard({ prompt: Prompt, introducibleCount: number })` — consumed by `app/(tabs)/index.tsx` (Task 6). Navigates to `/matchmaker/prompt-friends` (Task 5) internally, matching the existing self-navigating convention used by `FriendsRow`.

- [ ] **Step 1: Create the component**

```tsx
// components/home/PromptCard.tsx
import { Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { gradients, ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { elevation } from "../../constants/elevation";
import type { Prompt } from "../../lib/prompts";

interface PromptCardProps {
  prompt: Prompt;
  introducibleCount: number;
}

// Same "coming soon" convention as PrivacyPanel's onVisibilityPress in
// app/(tabs)/profile.tsx — no real Friend Visibility Settings screen yet.
function openFriendVisibilitySettings() {
  Alert.alert("Friend visibility settings", "This screen isn't built yet — hang tight.");
}

export function PromptCard({ prompt, introducibleCount }: PromptCardProps) {
  const locked = introducibleCount < 2;

  function handlePress() {
    if (locked) {
      openFriendVisibilitySettings();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/matchmaker/prompt-friends" as never);
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={locked ? "Friend visibility settings" : "Today's prompt"}
    >
      {({ pressed }) => (
        <View style={[elevation.sm, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
          <LinearGradient
            colors={locked ? [ink[300], ink[200]] : gradients.sunset}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: radii.xl,
              padding: spacing[8],
              overflow: "hidden",
            }}
          >
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: fontSize.xs[0],
                letterSpacing: 1,
                textTransform: "uppercase",
                color: locked ? ink[700] : "#FFFFFF",
              }}
            >
              {locked ? "Prompt locked" : "Today's prompt"}
            </Text>
            <Text
              style={{
                marginTop: spacing[4],
                fontFamily: fonts.display,
                fontSize: fontSize["2xl"][0],
                lineHeight: fontSize["2xl"][1],
                color: locked ? ink[900] : "#FFFFFF",
              }}
            >
              {locked
                ? "Add a friend who'll let you introduce them to unlock today's prompt."
                : prompt.text}
            </Text>
          </LinearGradient>
        </View>
      )}
    </Pressable>
  );
}

export default PromptCard;
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/home/PromptCard.tsx
git commit -m "feat: add PromptCard component with normal and locked states"
```

---

### Task 5: Prompt friends screen

**Files:**
- Create: `app/matchmaker/prompt-friends.tsx`

**Interfaces:**
- Consumes: `getTodaysPrompt()` (Task 2), `getIntroducibleFriends()` (Task 3), `sortFriendsByPromptMatch()` (Task 3), `Avatar` from `components/ui/Avatar.tsx`.
- Produces: the `/matchmaker/prompt-friends` route, navigated to from `PromptCard` (Task 4). Navigates onward to `/matchmaker/select?preselect=<id>` (existing screen, unmodified).

- [ ] **Step 1: Create the screen**

```tsx
// app/matchmaker/prompt-friends.tsx
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "../../components/ui/Avatar";
import { getIntroducibleFriends } from "../../components/matchmaker/mockMatchmakerFriends";
import { sortFriendsByPromptMatch } from "../../lib/promptMatch";
import { getTodaysPrompt } from "../../lib/prompts";
import { ink, surface } from "../../constants/colors";
import { fonts, fontSize, textStyles } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";

function XIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6l12 12M18 6 6 18"
        stroke={ink[900]}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function PromptFriendsScreen() {
  const insets = useSafeAreaInsets();
  const prompt = getTodaysPrompt();
  const friends = sortFriendsByPromptMatch(getIntroducibleFriends(), prompt.keywords);

  function handleSelect(friendId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/matchmaker/select?preselect=${friendId}` as never);
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: surface.cream,
        borderTopLeftRadius: radii["2xl"],
        borderTopRightRadius: radii["2xl"],
        overflow: "hidden",
        paddingTop: insets.top,
      }}
    >
      <View style={{ alignItems: "center", paddingTop: spacing[2] }}>
        <View style={{ width: 40, height: 5, borderRadius: radii.pill, backgroundColor: ink[300] }} />
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing[6],
          paddingTop: spacing[4],
        }}
      >
        <Pressable
          onPress={() => router.canGoBack() && router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <XIcon />
        </Pressable>
        <Text style={textStyles.eyebrow}>TODAY'S PROMPT</Text>
      </View>

      <View style={{ paddingHorizontal: spacing[6], paddingTop: spacing[6], gap: spacing[2] }}>
        <Text style={textStyles.heading}>{prompt.text}</Text>
        <Text style={textStyles.caption}>Tap a friend to start their intro.</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing[6],
          paddingTop: spacing[6],
          paddingBottom: insets.bottom + spacing[6],
          gap: spacing[4],
        }}
        showsVerticalScrollIndicator={false}
      >
        {friends.map((friend, index) => (
          <Pressable key={friend.id} onPress={() => handleSelect(friend.id)}>
            {({ pressed }) => (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[4],
                  padding: spacing[4],
                  borderRadius: radii.md,
                  backgroundColor: surface.paper,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                }}
              >
                <Avatar name={friend.name} size={48} index={index} imageUri={friend.imageUri} />
                <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.base[0], color: ink[900] }}>
                  {friend.name}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/matchmaker/prompt-friends.tsx
git commit -m "feat: add prompt-friends screen for the daily prompt flow"
```

---

### Task 6: Wire the Home screen branch

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `UserProfileRow.role` (Task 1), `PromptCard` (Task 4), `getTodaysPrompt` (Task 2), `getIntroducibleFriends` (Task 3).

- [ ] **Step 1: Update the screen**

Replace the full contents of `app/(tabs)/index.tsx` with:

```tsx
import { ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeHeader } from "../../components/home/HomeHeader";
import { IntroFeed } from "../../components/home/IntroFeed";
import { FriendsRow } from "../../components/home/FriendsRow";
import { PromptCard } from "../../components/home/PromptCard";
import { MOCK_INTROS } from "../../components/intro/mockIntros";
import { MOCK_FRIENDS } from "../../components/home/friendsMock";
import { TAB_BAR_CLEARANCE } from "../../components/home/TabBar";
import { getIntroducibleFriends } from "../../components/matchmaker/mockMatchmakerFriends";
import { getTodaysPrompt } from "../../lib/prompts";
import { useAuthStore } from "../../store/auth";
import { getUserProfile } from "../../lib/supabase";
import { surface } from "../../constants/colors";
import { spacing } from "../../constants/spacing";

// Turns the pending intros' matchmaker names into a one-line contextual
// subhead (e.g. "Maya and Jordan both wrote you notes") so returning to the
// screen with new intros feels event-driven rather than templated.
function formatIntroSubhead(matchmakerNames: string[]): string | undefined {
  const names = Array.from(new Set(matchmakerNames));
  if (names.length === 0) return undefined;
  if (names.length === 1) return `${names[0]} wrote you a note`;
  if (names.length === 2) return `${names[0]} and ${names[1]} both wrote you notes`;
  return `${names[0]}, ${names[1]}, and ${names.length - 2} more wrote you notes`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: profile, isLoading } = useQuery({
    queryKey: ["userProfile", userId],
    queryFn: () => getUserProfile(userId!),
    enabled: !!userId,
  });
  // The app only ever addresses people by first name (see intro-note copy) —
  // `name` in the users table holds the full "First Last" string.
  const name = profile?.name?.split(" ")[0];
  const introSubhead = formatIntroSubhead(MOCK_INTROS.map((intro) => intro.matchmakerName));
  // Missing/null role (pre-existing users, or onboarding reached without an
  // intent param) defaults to the existing wing-me behavior.
  const isWingman = profile?.role === "wing-somebody";

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing[4],
          // Reserve the full floating tab bar + FAB overhang, plus breathing
          // room, so the FriendsRow never sits underneath the FAB.
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE + spacing[4],
          paddingHorizontal: spacing[6],
          gap: spacing[8],
        }}
      >
        <HomeHeader name={name} loading={!!userId && isLoading} subhead={introSubhead} />
        {isWingman ? (
          <PromptCard prompt={getTodaysPrompt()} introducibleCount={getIntroducibleFriends().length} />
        ) : (
          <IntroFeed intros={MOCK_INTROS} />
        )}
        <FriendsRow friends={MOCK_FRIENDS} />
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/index.tsx"
git commit -m "feat: branch Home screen on role to show the daily Prompt Card"
```

---

### Task 7: Manual end-to-end verification

No test runner exists in this repo, so this task is the live-behavior check that stands in for it (same convention as every prior spec's "Testing" section). If this plan is executed in an environment without a simulator/device (e.g. this project's memory notes an agent sandbox with no iOS simulator), run everything that's possible via `expo start --web` and explicitly flag any native-only step as still owed rather than skipping it silently.

- [ ] **Step 1: Full project typecheck**

Run: `npm run typecheck`
Expected: no errors across all files touched in Tasks 1-6.

- [ ] **Step 2: Start the dev server**

Run: `npx expo start` (or `--web` if no simulator/device is available in the current environment).

- [ ] **Step 3: Verify the wing-me branch is unchanged**

Sign in (or use an existing session) with a user whose `role` is `null` or `"wing-me"`. On the Home tab ("For You"), confirm: the existing intro feed renders exactly as before (or `EmptyIntrosState` if there are no mock intros for that path), `FriendsRow` renders below it, and the FAB is present. No `PromptCard` should appear.

- [ ] **Step 4: Verify the wingman branch and locked state**

Set that user's `role` to `"wing-somebody"` (via the Supabase table editor, or by re-running onboarding choosing "I'll wing somebody"). Reload Home. Confirm: `IntroFeed` is gone, a `PromptCard` renders in its place with today's prompt text, `FriendsRow` and the FAB are unchanged below it.

Then temporarily force the locked state to confirm it doesn't dead-end: in `components/matchmaker/mockMatchmakerFriends.ts`, temporarily change all entries but one to `canIntroduce: false` (or pass `introducibleCount={1}` directly to `<PromptCard />` in `index.tsx` for a quicker check), reload, and confirm the card switches to its dimmed "Prompt locked" copy and tapping it shows the "Friend visibility settings" coming-soon alert instead of opening an empty screen. Revert the temporary change afterward.

- [ ] **Step 5: Verify keyword reordering**

Temporarily change the `getTodaysPrompt()` call in `app/matchmaker/prompt-friends.tsx` to `getTodaysPrompt(new Date(2026, 0, 23))` (day-of-year 22 → `PROMPTS[22]`, the pickleball/basketball/sports prompt). Tap the `PromptCard`, and on the resulting list confirm **Sam Rivera appears first** (his bio prompt mentions "pickleball"), with the remaining introducible friends following in their original order. Revert the temporary date override afterward.

- [ ] **Step 6: Verify the hand-off into Matchmaker Step 1**

From the friend list, tap any friend row. Confirm it lands on Matchmaker Step 1 (`/matchmaker/select`) with that friend already shown as selected/person A, and that picking a second friend and continuing through Step 2 (write note + send) behaves exactly as it does today from any other entry point.

- [ ] **Step 7: Confirm the FAB still bypasses the prompt**

From the wingman-role Home screen, tap the FAB directly (not through the Prompt Card). Confirm it opens the freeform Matchmaker Step 1 flow with no friend preselected, same as before this feature existed.

- [ ] **Step 8: Final commit (if any revert/cleanup diffs remain)**

```bash
git status
```

Expected: clean (all temporary test overrides from Steps 4-5 reverted, no stray diffs). If anything remains, revert it before finishing.
