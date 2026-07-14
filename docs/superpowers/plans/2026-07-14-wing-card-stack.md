# On Wing Card Stack (Wingman Home) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the small-avatar "On Wing" `FriendsRow` with a swipeable, full-bleed photo-card carousel (`WingCardStack`) on the wingman-only Home screen (`role: "wing-somebody"`), so a wingman can actually see friends' faces while browsing who to introduce. The wing-me/null-role Home screen is untouched.

**Architecture:** A new component, `components/home/WingCardStack.tsx`, mirrors two existing established patterns in this codebase rather than inventing new ones: the horizontal-paging-with-dots carousel from `components/friend/FriendPhotoPromptPanel.tsx` (`ReadOnlyPhotoCarousel` + `CarouselDots`), and the shadow-safe two-layer card structure from `components/home/PromptCard.tsx` (outer `View` carries `elevation`, inner `View` carries `borderRadius` + `overflow: "hidden"` + content, avoiding the RN quirk where a shadow and `overflow: hidden` on the same view clip the shadow). Each card shows one friend's photo full-bleed with a bottom gradient scrim and their first name, styled like `IntroNoteCard`'s hero-card language. `friendsMock.ts`'s `MOCK_FRIENDS` fixture — which today has no `imageUri` set for anyone, so `FriendsRow` already silently falls back to initials — gets each friend's first photo populated from `components/friend/mockFriendProfiles.ts` (same ids, already keyed 1:1 across both fixtures). `app/(tabs)/index.tsx`'s existing `isWingman` branch swaps `FriendsRow` for `WingCardStack` only on the wingman path; `FriendsRow.tsx` itself is not modified.

**Tech Stack:** Expo Router, React Native, TypeScript (strict), Reanimated (entrance animation only), expo-haptics, expo-linear-gradient. No test runner is configured in this repo (no jest/vitest, no `*.test.ts` files anywhere) — verification follows the project's existing convention of `npm run typecheck` per task plus one consolidated manual dev-server walkthrough at the end.

## Global Constraints

- Design tokens only — no magic numbers. Colors from `constants/colors.ts`, spacing from the 4px scale in `constants/spacing.ts`, radii from `constants/spacing.ts`, shadows from `constants/elevation.ts`, fonts/text styles from `constants/typography.ts`.
- Never style a bare `Pressable` — visuals (background, scale transform) go on an inner `View` inside the render-prop, per the existing `Button.tsx` / `PromptCard` pattern (this app's `Pressable` styles silently don't paint on-device otherwise).
- Card shadow (`elevation.sm`) and `borderRadius`/`overflow: "hidden"` must live on separate nested `View`s (outer = shadow, inner = clipped content) — same structure `PromptCard.tsx` already uses, otherwise the shadow gets clipped.
- `WingCardStack` shows one friend's photo per card, swiping moves between friends (not between one friend's multiple photos).
- Card tap destination is `/friend/[friendId]` — identical route and haptic (`Haptics.impactAsync(Light)`) to `FriendsRow`'s existing `FriendAvatarButton`.
- `FriendsRow.tsx` and the wing-me/null-role Home screen path are not modified.
- `MOCK_FRIENDS` data/order is unchanged — only `imageUri` is added per entry. No filtering by matchmaker eligibility.
- Keep files under 500 lines.
- Read a file before editing it.

---

### Task 1: Populate real photos in the friends fixture

**Files:**
- Modify: `components/home/friendsMock.ts`

**Interfaces:**
- Produces: `WingFriend.imageUri` populated for all 7 entries — consumed by `WingCardStack` (Task 2) and still consumed by the existing `FriendsRow` (unchanged rendering, now shows real photos too since `Avatar` already supports `imageUri`).

- [ ] **Step 1: Add `imageUri` to each entry**

Replace the full contents of `components/home/friendsMock.ts` with:

```ts
export interface WingFriend {
  id: string;
  name: string;
  imageUri?: string;
}

// Throwaway fixture data until friendships are wired to Supabase.
// imageUri is each friend's first photo from mockFriendProfiles.ts (same
// ids, shared 1:1 across friendsMock/mockMatchmakerFriends/mockFriendProfiles
// per existing code comments) — populated so FriendsRow and WingCardStack
// show real faces instead of falling back to initials.
export const MOCK_FRIENDS: WingFriend[] = [
  { id: "1", name: "Sam Rivera", imageUri: "https://i.pravatar.cc/400?img=11" },
  { id: "2", name: "Priya Nair", imageUri: "https://i.pravatar.cc/400?img=21" },
  { id: "3", name: "Jordan Blake", imageUri: "https://i.pravatar.cc/400?img=31" },
  { id: "4", name: "Maya Chen", imageUri: "https://i.pravatar.cc/400?img=41" },
  { id: "5", name: "Theo Marsh", imageUri: "https://i.pravatar.cc/400?img=51" },
  { id: "6", name: "Ana Sousa", imageUri: "https://i.pravatar.cc/400?img=61" },
  { id: "7", name: "Kai Fischer", imageUri: "https://i.pravatar.cc/400?img=71" },
];
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Verify by construction**

Each `imageUri` matches `MOCK_FRIEND_PROFILES[id].photos[0]` in
`components/friend/mockFriendProfiles.ts` exactly (e.g. id `"1"` Sam
Rivera → `https://i.pravatar.cc/400?img=11` in both files). This is
exercised live in Task 4.

- [ ] **Step 4: Commit**

```bash
git add components/home/friendsMock.ts
git commit -m "feat: populate On Wing friend photos in the mock fixture"
```

---

### Task 2: WingCardStack component

**Files:**
- Create: `components/home/WingCardStack.tsx`

**Interfaces:**
- Consumes: `WingFriend` from `components/home/friendsMock.ts` (Task 1).
- Produces: `WingCardStack({ friends: WingFriend[] })` — consumed by `app/(tabs)/index.tsx` (Task 3). Navigates to `/friend/[friendId]` internally, matching `FriendsRow`'s existing self-navigating convention.

- [ ] **Step 1: Create the component**

```tsx
// components/home/WingCardStack.tsx
import { useState } from "react";
import {
  Image,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { coral, ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { elevation } from "../../constants/elevation";
import type { WingFriend } from "./friendsMock";

interface WingCardStackProps {
  friends: WingFriend[];
}

// Matches FriendsRow's own entrance delay — this replaces that row 1:1 on
// the wingman home screen, so it should animate in at the same beat.
const ENTRANCE_DELAY = 280;

function StackDots({ count, activeIndex }: { count: number; activeIndex: number }) {
  if (count <= 1) return null;
  return (
    <View style={{ flexDirection: "row", gap: 6, justifyContent: "center" }}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            width: i === activeIndex ? 20 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === activeIndex ? coral[500] : ink[200],
          }}
        />
      ))}
    </View>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function WingCard({ friend }: { friend: WingFriend }) {
  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/friend/${friend.id}` as never);
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={friend.name}
    >
      {({ pressed }) => (
        <View style={[elevation.sm, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
          <View style={{ borderRadius: radii.xl, overflow: "hidden", aspectRatio: 4 / 5 }}>
            {friend.imageUri ? (
              <Image source={{ uri: friend.imageUri }} style={{ width: "100%", height: "100%" }} />
            ) : (
              <View
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: coral[100],
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize["4xl"][0], color: coral[600] }}>
                  {initials(friend.name)}
                </Text>
              </View>
            )}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.55)"]}
              style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "40%" }}
            />
            <View style={{ position: "absolute", left: spacing[4], bottom: spacing[4] }}>
              <Text style={{ fontFamily: fonts.display, fontSize: fontSize["2xl"][0], lineHeight: fontSize["2xl"][1], color: "#FFFFFF" }}>
                {friend.name.split(" ")[0]}
              </Text>
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export function WingCardStack({ friends }: WingCardStackProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  function handleLayout(e: LayoutChangeEvent) {
    setContainerWidth(e.nativeEvent.layout.width);
  }

  function handleMomentumScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!containerWidth) return;
    setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / containerWidth));
  }

  return (
    <Animated.View entering={FadeInDown.duration(250).delay(ENTRANCE_DELAY)} style={{ gap: spacing[4] }}>
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: fontSize.xs[0],
          letterSpacing: 1,
          textTransform: "uppercase",
          color: coral[500],
        }}
      >
        On Wing
      </Text>

      <View onLayout={handleLayout} style={{ gap: spacing[4] }}>
        {containerWidth > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleMomentumScrollEnd}
          >
            {friends.map((friend) => (
              <View key={friend.id} style={{ width: containerWidth, padding: 2 }}>
                <WingCard friend={friend} />
              </View>
            ))}
          </ScrollView>
        )}
        <StackDots count={friends.length} activeIndex={activeIndex} />
      </View>
    </Animated.View>
  );
}

export default WingCardStack;
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/home/WingCardStack.tsx
git commit -m "feat: add WingCardStack swipeable photo-card component"
```

---

### Task 3: Wire the wingman Home screen branch

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `WingCardStack` (Task 2), existing `isWingman` boolean (already derived from `UserProfileRow.role`).

- [ ] **Step 1: Update the screen**

Replace the full contents of `app/(tabs)/index.tsx` with:

```tsx
import { ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeHeader } from "../../components/home/HomeHeader";
import { IntroFeed } from "../../components/home/IntroFeed";
import { FriendsRow } from "../../components/home/FriendsRow";
import { WingCardStack } from "../../components/home/WingCardStack";
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
          // room, so the last section never sits underneath the FAB.
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
        {isWingman ? <WingCardStack friends={MOCK_FRIENDS} /> : <FriendsRow friends={MOCK_FRIENDS} />}
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
git commit -m "feat: swap On Wing card stack in for FriendsRow on the wingman home screen"
```

---

### Task 4: Update CLAUDE.md file structure notes

**Files:**
- Modify: `CLAUDE.md`

Per this project's own Self-Maintenance Rule ("After every major implementation... update this CLAUDE.md file immediately to reflect the current state").

- [ ] **Step 1: Update the `/(tabs)` index.tsx line**

In the `## File Structure` section, replace:

```
    index.tsx          — home feed; wing-me/null-role users see the unchanged incoming-intros feed + friends row; wing-somebody (wingman-only) users see a daily PromptCard in place of the intro feed, friends row unchanged below it either way
```

with:

```
    index.tsx          — home feed; wing-me/null-role users see the unchanged incoming-intros feed + FriendsRow (small avatars); wing-somebody (wingman-only) users see a daily PromptCard in place of the intro feed, and WingCardStack (full-bleed swipeable photo cards) in place of FriendsRow below it
```

- [ ] **Step 2: Update the `/components/home` line**

Replace:

```
  /home                — HomeHeader, IntroFeed, EmptyIntrosState, FriendsRow, TabBar, friendsMock (wing-me/null-role Home screen use), PromptCard (Sunset-gradient card styled like IntroNoteCard; normal state opens /matchmaker/prompt-friends, locked state when introducibleCount < 2 opens the Friend visibility settings coming-soon alert instead — wing-somebody Home screen use)
```

with:

```
  /home                — HomeHeader, IntroFeed, EmptyIntrosState, FriendsRow (small-avatar horizontal row, wing-me/null-role Home screen use), TabBar, friendsMock (`WingFriend`, `MOCK_FRIENDS` — each entry now carries `imageUri`, its first photo from mockFriendProfiles; shared by FriendsRow and WingCardStack), PromptCard (Sunset-gradient card styled like IntroNoteCard; normal state opens /matchmaker/prompt-friends, locked state when introducibleCount < 2 opens the Friend visibility settings coming-soon alert instead — wing-somebody Home screen use), WingCardStack (full-bleed swipeable photo-card carousel + dot indicator, radii.xl + elevation.sm cards, name-over-photo gradient scrim; tap routes to /friend/[friendId] same as FriendsRow's avatars — wing-somebody Home screen use, replaces FriendsRow there)
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for the WingCardStack wingman home change"
```

---

### Task 5: Manual end-to-end verification

No test runner exists in this repo, so this task is the live-behavior check that stands in for it (same convention as every prior plan in `docs/superpowers/plans/`). If this plan is executed in an environment without a simulator/device (e.g. this project's memory notes an agent sandbox with no iOS simulator), run everything possible via `expo start --web` and explicitly flag any native-only step as still owed rather than skipping it silently.

- [ ] **Step 1: Full project typecheck**

Run: `npm run typecheck`
Expected: no errors across all files touched in Tasks 1-4.

- [ ] **Step 2: Start the dev server**

Run: `npx expo start` (or `--web` if no simulator/device is available in the current environment).

- [ ] **Step 3: Verify the wing-me branch is unchanged**

Sign in (or use an existing session) with a user whose `role` is `null` or `"wing-me"`. On the Home tab, confirm `FriendsRow` still renders as a small horizontal avatar row below the intro feed — but now showing real photos instead of initials (from Task 1's fixture change), same layout/behavior otherwise. No `WingCardStack` should appear.

- [ ] **Step 4: Verify the wingman branch shows the card stack**

Set that user's `role` to `"wing-somebody"` (via the Supabase table editor, or by re-running onboarding choosing "I'll wing somebody"). Reload Home. Below the `PromptCard`, confirm: one large photo card fills the section width, the friend's first name is legible over the bottom gradient scrim, and a row of dots appears below the card (7 dots, first one wide/coral, rest small/gray).

- [ ] **Step 5: Verify swipe paging and the dot indicator**

Swipe left through the card stack. Confirm each swipe pages exactly one card at a time (no partial/misaligned stops), the photo changes to the next friend (Sam Rivera → Priya Nair → Jordan Blake → ...), and the active dot updates to match the current card's position. Swipe back right and confirm it reverses correctly.

- [ ] **Step 6: Verify tap navigation**

Tap the current card. Confirm it navigates to `/friend/[friendId]` for that exact friend (matching name/photo on the destination screen), identical to tapping an avatar in `FriendsRow` today.

- [ ] **Step 7: Confirm the FAB and PromptCard are unaffected**

From the wingman-role Home screen, confirm the FAB still opens the freeform Matchmaker Step 1 flow and `PromptCard` still opens `/matchmaker/prompt-friends` — neither changed by this feature.

- [ ] **Step 8: Final cleanup check**

```bash
git status
```

Expected: clean (no stray diffs beyond the four commits from Tasks 1-4).
