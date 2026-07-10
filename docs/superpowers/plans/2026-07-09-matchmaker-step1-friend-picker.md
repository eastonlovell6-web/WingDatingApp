# Matchmaker Step 1 Friend Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/app/matchmaker/select.tsx`, the modal friend-picker sheet opened by the center FAB, per `docs/superpowers/specs/2026-07-09-matchmaker-step1-friend-picker-design.md`.

**Architecture:** A mock-data fixture (`mockMatchmakerFriends.ts`) mirrors the eventual `friendships`/`introductions` schema and exposes a pure `getFriendEligibility` function. Two presentational components (`FriendPickerChip`, `FriendPickerGrid`) render the grid; `MatchmakerEncouragementState` renders the &lt;2-eligible-friends fallback. The screen (`app/matchmaker/select.tsx`) owns selection/search state and composes all of the above, registered as a modal route in `app/_layout.tsx` and wired to the FAB in `TabBar.tsx`.

**Tech Stack:** Expo Router (typed routes), React Native + Reanimated 3, expo-haptics, existing design-token constants (`constants/colors.ts`, `constants/typography.ts`, `constants/spacing.ts`) and `components/ui/{Avatar,Button,Input}.tsx`. No test runner is configured in this project (`package.json` only has `typecheck`/`lint` scripts, and no prior screen has unit tests) — verification per task is `npm run typecheck` + `npm run lint`, plus a final manual pass in the running app.

## Global Constraints

- Mock data only — no Supabase queries for friendships/introductions (matches every other list screen in the app today: `friendsMock.ts`, `mockChats.ts`, `mockSentIntros.ts`, etc.)
- Eligibility is per-person, not per-pair — pair validation happens in Step 2 (not built here)
- Selection cap is exactly 2; tapping a 3rd eligible chip must not change selection, must shake, and must fire `Haptics.NotificationFeedbackType.Warning` (distinct from `Light`/`Medium` impact haptics and `Success` notification haptics used elsewhere in the app)
- Ineligible captions: `"Hasn't opted in"` when `canIntroduce === false`, `"3 pending intros"` when `activePendingCount >= 3` — never collapsed into one caption
- Headline copy: `"Who should meet?"` before any selection, `"Nice. Who's their match?"` once ≥1 friend is picked
- Subhead copy (fixed, never changes): `"Pick two friends you think would click."`
- Footer button label: generic while `<2` selected, `` `Continue with ${firstName} & ${secondName}` `` once exactly 2 are selected, using first names only (`name.split(" ")[0]`)
- Encouragement-state copy (fixed): headline `"Matchmaking takes two (of your friends)"`, subhead `"Invite friends to Wing so you can start setting people up."`, primary button `"Invite friends"`, secondary link `"Not now"`
- Design tokens only — colors from `constants/colors.ts`, spacing from `constants/spacing.ts` (4px scale), radii from `constants/spacing.ts` (`radii["2xl"]` = 36px for the sheet's top corners), text from `constants/typography.ts`. No magic numbers for spacing.
- Step 2 (`/matchmaker/note`) is out of scope — the Continue button only needs to push the route with `friendAId`/`friendBId` params; that route file is not created in this plan
- Typed routes are enabled (`app.json` → `experiments.typedRoutes`). Any `router.push` to a route that doesn't exist as a file yet must use the `as never` cast, matching the existing convention in `components/dev/DevNav.tsx:46`

---

### Task 1: Mock data + eligibility helpers

**Files:**
- Create: `components/matchmaker/mockMatchmakerFriends.ts`

**Interfaces:**
- Consumes: nothing (leaf file)
- Produces:
  - `interface MatchmakerFriend { id: string; name: string; imageUri?: string; canIntroduce: boolean; activePendingCount: number }`
  - `type FriendEligibility = "eligible" | "not_opted_in" | "at_cap"`
  - `function getFriendEligibility(friend: MatchmakerFriend): FriendEligibility`
  - `function getIneligibleCaption(eligibility: FriendEligibility): string | undefined`
  - `const MOCK_MATCHMAKER_FRIENDS: MatchmakerFriend[]` — 7 entries, including at least one `canIntroduce: false` and one `activePendingCount >= 3`, so both ineligible captions and the eligible state are all exercised by the fixture alone

- [ ] **Step 1: Write the fixture file**

```ts
// components/matchmaker/mockMatchmakerFriends.ts

export interface MatchmakerFriend {
  id: string;
  name: string;
  imageUri?: string;
  canIntroduce: boolean; // friendships.can_introduce for this friend -> current user
  activePendingCount: number; // count of introductions where this friend is
                               // user_a_id/user_b_id and status is pending_a/
                               // pending_b/both_pending
}

export type FriendEligibility = "eligible" | "not_opted_in" | "at_cap";

export function getFriendEligibility(friend: MatchmakerFriend): FriendEligibility {
  if (!friend.canIntroduce) return "not_opted_in";
  if (friend.activePendingCount >= 3) return "at_cap";
  return "eligible";
}

export function getIneligibleCaption(eligibility: FriendEligibility): string | undefined {
  if (eligibility === "not_opted_in") return "Hasn't opted in";
  if (eligibility === "at_cap") return "3 pending intros";
  return undefined;
}

// Throwaway fixture data until friendships/introductions are wired to Supabase.
export const MOCK_MATCHMAKER_FRIENDS: MatchmakerFriend[] = [
  { id: "1", name: "Sam Rivera", canIntroduce: true, activePendingCount: 0 },
  { id: "2", name: "Priya Nair", canIntroduce: true, activePendingCount: 1 },
  { id: "3", name: "Jordan Blake", canIntroduce: true, activePendingCount: 0 },
  { id: "4", name: "Maya Chen", canIntroduce: true, activePendingCount: 0 },
  { id: "5", name: "Theo Marsh", canIntroduce: false, activePendingCount: 0 },
  { id: "6", name: "Ana Sousa", canIntroduce: true, activePendingCount: 3 },
  { id: "7", name: "Kai Fischer", canIntroduce: true, activePendingCount: 2 },
];
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors referencing `mockMatchmakerFriends.ts`

- [ ] **Step 3: Commit**

```bash
git add components/matchmaker/mockMatchmakerFriends.ts
git commit -m "feat: add matchmaker friend-picker mock data and eligibility helpers"
```

---

### Task 2: FriendPickerChip component

**Files:**
- Create: `components/matchmaker/FriendPickerChip.tsx`

**Interfaces:**
- Consumes: `MatchmakerFriend`, `FriendEligibility`, `getIneligibleCaption` from `components/matchmaker/mockMatchmakerFriends.ts` (Task 1); `Avatar` from `components/ui/Avatar.tsx`
- Produces: `FriendPickerChip({ friend, index, eligibility, selected, atSelectionLimit, onToggle }: FriendPickerChipProps)` where
  `interface FriendPickerChipProps { friend: MatchmakerFriend; index: number; eligibility: FriendEligibility; selected: boolean; atSelectionLimit: boolean; onToggle: (friendId: string) => void }`

- [ ] **Step 1: Write the component**

```tsx
// components/matchmaker/FriendPickerChip.tsx
import { Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Avatar } from "../ui/Avatar";
import { coral, ink, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii } from "../../constants/spacing";
import {
  getIneligibleCaption,
  type FriendEligibility,
  type MatchmakerFriend,
} from "./mockMatchmakerFriends";

interface FriendPickerChipProps {
  friend: MatchmakerFriend;
  index: number;
  eligibility: FriendEligibility;
  selected: boolean;
  atSelectionLimit: boolean;
  onToggle: (friendId: string) => void;
}

function CheckIcon() {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 13l4 4L19 7"
        stroke="#FFFFFF"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function FriendPickerChip({
  friend,
  index,
  eligibility,
  selected,
  atSelectionLimit,
  onToggle,
}: FriendPickerChipProps) {
  const shakeX = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const interactive = eligibility === "eligible";
  const caption = interactive ? undefined : getIneligibleCaption(eligibility);

  function handlePress() {
    if (!interactive) return;

    if (!selected && atSelectionLimit) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      shakeX.value = withSequence(
        withTiming(-6, { duration: 40 }),
        withTiming(6, { duration: 80 }),
        withTiming(-4, { duration: 80 }),
        withTiming(4, { duration: 80 }),
        withTiming(0, { duration: 60 })
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(friend.id);
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={!interactive}
      accessible
      accessibilityRole="button"
      accessibilityLabel={friend.name}
      accessibilityState={{ selected, disabled: !interactive }}
      style={{ width: "100%" }}
    >
      <Animated.View
        style={[{ alignItems: "center", gap: 6, opacity: interactive ? 1 : 0.4 }, animatedStyle]}
      >
        <View style={{ width: 64, height: 64, alignItems: "center", justifyContent: "center" }}>
          {selected && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 62,
                height: 62,
                borderRadius: radii.pill,
                borderWidth: 2.5,
                borderColor: coral[500],
              }}
            />
          )}
          <Avatar name={friend.name} size={56} index={index} imageUri={friend.imageUri} />
          {selected && (
            <View
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 20,
                height: 20,
                borderRadius: radii.pill,
                backgroundColor: coral[500],
                borderWidth: 2,
                borderColor: surface.paper,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CheckIcon />
            </View>
          )}
        </View>
        <Text
          style={{ fontFamily: fonts.body, fontSize: fontSize.sm[0], color: ink[900], textAlign: "center" }}
          numberOfLines={1}
        >
          {friend.name.split(" ")[0]}
        </Text>
        {caption ? (
          <Text
            style={{ fontFamily: fonts.body, fontSize: fontSize.xs[0], color: ink[500], textAlign: "center" }}
            numberOfLines={2}
          >
            {caption}
          </Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

export default FriendPickerChip;
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors referencing `FriendPickerChip.tsx`

- [ ] **Step 3: Commit**

```bash
git add components/matchmaker/FriendPickerChip.tsx
git commit -m "feat: add FriendPickerChip with eligible/selected/ineligible states"
```

---

### Task 3: FriendPickerGrid component

**Files:**
- Create: `components/matchmaker/FriendPickerGrid.tsx`

**Interfaces:**
- Consumes: `FriendPickerChip` (Task 2), `MatchmakerFriend`, `getFriendEligibility` from Task 1
- Produces: `FriendPickerGrid({ friends, selectedIds, onToggle }: FriendPickerGridProps)` where
  `interface FriendPickerGridProps { friends: MatchmakerFriend[]; selectedIds: string[]; onToggle: (friendId: string) => void }`

- [ ] **Step 1: Write the component**

```tsx
// components/matchmaker/FriendPickerGrid.tsx
import { useState } from "react";
import { LayoutChangeEvent, View } from "react-native";
import { spacing } from "../../constants/spacing";
import { FriendPickerChip } from "./FriendPickerChip";
import { getFriendEligibility, type MatchmakerFriend } from "./mockMatchmakerFriends";

interface FriendPickerGridProps {
  friends: MatchmakerFriend[];
  selectedIds: string[];
  onToggle: (friendId: string) => void;
}

const COLUMNS = 4;

export function FriendPickerGrid({ friends, selectedIds, onToggle }: FriendPickerGridProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const gap = spacing[4];
  const chipWidth = containerWidth > 0 ? (containerWidth - gap * (COLUMNS - 1)) / COLUMNS : 0;

  function handleLayout(event: LayoutChangeEvent) {
    setContainerWidth(event.nativeEvent.layout.width);
  }

  return (
    <View
      onLayout={handleLayout}
      style={{ flexDirection: "row", flexWrap: "wrap", gap }}
    >
      {friends.map((friend, index) => {
        const eligibility = getFriendEligibility(friend);
        return (
          <View key={friend.id} style={{ width: chipWidth || undefined }}>
            <FriendPickerChip
              friend={friend}
              index={index}
              eligibility={eligibility}
              selected={selectedIds.includes(friend.id)}
              atSelectionLimit={selectedIds.length >= 2}
              onToggle={onToggle}
            />
          </View>
        );
      })}
    </View>
  );
}

export default FriendPickerGrid;
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors referencing `FriendPickerGrid.tsx`

- [ ] **Step 3: Commit**

```bash
git add components/matchmaker/FriendPickerGrid.tsx
git commit -m "feat: add FriendPickerGrid four-column layout"
```

---

### Task 4: MatchmakerEncouragementState component

**Files:**
- Create: `components/matchmaker/MatchmakerEncouragementState.tsx`

**Interfaces:**
- Consumes: `Button` from `components/ui/Button.tsx`
- Produces: `MatchmakerEncouragementState({ onInvitePress, onNotNowPress }: MatchmakerEncouragementStateProps)` where
  `interface MatchmakerEncouragementStateProps { onInvitePress: () => void; onNotNowPress: () => void }`

- [ ] **Step 1: Write the component**

```tsx
// components/matchmaker/MatchmakerEncouragementState.tsx
import { Pressable, Text, View } from "react-native";
import { Button } from "../ui/Button";
import { ink } from "../../constants/colors";
import { fonts, fontSize, textStyles } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

interface MatchmakerEncouragementStateProps {
  onInvitePress: () => void;
  onNotNowPress: () => void;
}

export function MatchmakerEncouragementState({
  onInvitePress,
  onNotNowPress,
}: MatchmakerEncouragementStateProps) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing[6],
        paddingHorizontal: spacing[6],
      }}
    >
      <View style={{ gap: spacing[2] }}>
        <Text style={[textStyles.heading, { textAlign: "center" }]}>
          Matchmaking takes two (of your friends)
        </Text>
        <Text style={[textStyles.caption, { textAlign: "center" }]}>
          Invite friends to Wing so you can start setting people up.
        </Text>
      </View>
      <Button title="Invite friends" onPress={onInvitePress} />
      <Pressable onPress={onNotNowPress} hitSlop={8} accessibilityRole="button" accessibilityLabel="Not now">
        <Text style={{ fontFamily: fonts.body, fontSize: fontSize.sm[0], color: ink[500] }}>
          Not now
        </Text>
      </Pressable>
    </View>
  );
}

export default MatchmakerEncouragementState;
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors referencing `MatchmakerEncouragementState.tsx`

- [ ] **Step 3: Commit**

```bash
git add components/matchmaker/MatchmakerEncouragementState.tsx
git commit -m "feat: add MatchmakerEncouragementState fewer-than-two-friends fallback"
```

---

### Task 5: Screen shell — app/matchmaker/select.tsx

**Files:**
- Create: `app/matchmaker/select.tsx`

**Interfaces:**
- Consumes: `FriendPickerGrid` (Task 3), `MatchmakerEncouragementState` (Task 4), `MOCK_MATCHMAKER_FRIENDS`, `getFriendEligibility` (Task 1), `Input`/`Button` from `components/ui/`
- Produces: default-exported `MatchmakerSelectScreen` route component at path `/matchmaker/select`. Pushes `` `/matchmaker/note?friendAId=${id}&friendBId=${id}` `` (cast `as never` — that route doesn't exist yet) when Continue is pressed with exactly 2 selected.

- [ ] **Step 1: Write the screen**

```tsx
// app/matchmaker/select.tsx
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { FriendPickerGrid } from "../../components/matchmaker/FriendPickerGrid";
import { MatchmakerEncouragementState } from "../../components/matchmaker/MatchmakerEncouragementState";
import {
  MOCK_MATCHMAKER_FRIENDS,
  getFriendEligibility,
} from "../../components/matchmaker/mockMatchmakerFriends";
import { ink, surface } from "../../constants/colors";
import { textStyles } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";

const spring = { mass: 0.4, damping: 12, stiffness: 220 };

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

export default function MatchmakerSelectScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const eligibleCount = MOCK_MATCHMAKER_FRIENDS.filter(
    (f) => getFriendEligibility(f) === "eligible"
  ).length;
  const showEncouragement = eligibleCount < 2;

  const filteredFriends = MOCK_MATCHMAKER_FRIENDS.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedFriends = MOCK_MATCHMAKER_FRIENDS.filter((f) => selectedIds.includes(f.id));
  const canContinue = selectedIds.length === 2;

  const buttonScale = useSharedValue(1);
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  useEffect(() => {
    if (canContinue) {
      buttonScale.value = withSequence(withSpring(1.06, spring), withSpring(1, spring));
    }
  }, [canContinue]);

  function handleToggle(friendId: string) {
    setSelectedIds((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  }

  function handleContinue() {
    if (!canContinue) return;
    router.push(
      `/matchmaker/note?friendAId=${selectedIds[0]}&friendBId=${selectedIds[1]}` as never
    );
  }

  function handleInvitePress() {
    // TODO: hand off to the Invite flow once it exists (same stub convention
    // as FriendsRow.handleFriendPress / HomeHeader's unwired onInvitePress).
    console.log("[matchmaker/select] invite friends tapped");
  }

  const headline = selectedIds.length === 0 ? "Who should meet?" : "Nice. Who's their match?";
  const continueLabel = canContinue
    ? `Continue with ${selectedFriends[0].name.split(" ")[0]} & ${selectedFriends[1].name.split(" ")[0]}`
    : "Continue";

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
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
          <XIcon />
        </Pressable>
        <Text style={textStyles.eyebrow}>STEP 1 OF 2</Text>
      </View>

      {showEncouragement ? (
        <MatchmakerEncouragementState
          onInvitePress={handleInvitePress}
          onNotNowPress={() => router.back()}
        />
      ) : (
        <>
          <View style={{ paddingHorizontal: spacing[6], paddingTop: spacing[6], gap: spacing[2] }}>
            <Text style={textStyles.heading}>{headline}</Text>
            <Text style={textStyles.caption}>Pick two friends you think would click.</Text>
          </View>

          <View style={{ paddingHorizontal: spacing[6], paddingTop: spacing[6] }}>
            <Input
              placeholder="Search friends"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: spacing[6],
              paddingTop: spacing[6],
              paddingBottom: spacing[4],
            }}
            showsVerticalScrollIndicator={false}
          >
            <FriendPickerGrid friends={filteredFriends} selectedIds={selectedIds} onToggle={handleToggle} />
          </ScrollView>

          <View
            style={{
              paddingHorizontal: spacing[6],
              paddingTop: spacing[4],
              paddingBottom: insets.bottom + spacing[4],
              borderTopWidth: 1,
              borderTopColor: ink[200],
            }}
          >
            <Animated.View style={buttonAnimatedStyle}>
              <Button title={continueLabel} onPress={handleContinue} disabled={!canContinue} />
            </Animated.View>
          </View>
        </>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors referencing `app/matchmaker/select.tsx`

- [ ] **Step 3: Commit**

```bash
git add app/matchmaker/select.tsx
git commit -m "feat: add Matchmaker Step 1 friend-picker screen"
```

---

### Task 6: Modal route registration, FAB wiring, DevNav entry, manual verification

**Files:**
- Modify: `app/_layout.tsx:63`
- Modify: `components/home/TabBar.tsx:87-90`
- Modify: `components/dev/DevNav.tsx:21-33`

**Interfaces:**
- Consumes: `app/matchmaker/select.tsx` (Task 5) must already exist as a route file
- Produces: nothing consumed by later tasks — this is the final integration task

- [ ] **Step 1: Register the modal presentation in the root Stack**

In `app/_layout.tsx`, replace:

```tsx
        <Stack screenOptions={{ headerShown: false }} />
```

with:

```tsx
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name="matchmaker/select"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
        </Stack>
```

- [ ] **Step 2: Wire the FAB to navigate**

In `components/home/TabBar.tsx`, replace:

```tsx
  function handleFabPress() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // TODO: router.push('/matchmaker/select')
  }
```

with:

```tsx
  function handleFabPress() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push("/matchmaker/select" as never);
  }
```

This requires importing `router` from `expo-router` at the top of `components/home/TabBar.tsx` (it is not currently imported there):

```tsx
import { router } from "expo-router";
```

Add that import alongside the existing `expo-router` type-only import (`BottomTabBarProps` comes from `@react-navigation/bottom-tabs`, so this is a new import line, not a merge).

- [ ] **Step 3: Add a DevNav jump entry**

In `components/dev/DevNav.tsx`, insert a new entry into `ROUTES` right after `"Home"` so the ◀▶ steppers walk into the matchmaker flow at the right point:

```tsx
const ROUTES: Route[] = [
  { label: "Landing", href: "/" },
  { label: "Phone", href: "/(auth)" },
  { label: "Intent", href: "/(auth)/intent" },
  { label: "Verify", href: "/(auth)/verify" },
  { label: "Onboarding", href: "/(auth)/onboarding" },
  { label: "Home", href: "/(tabs)" },
  { label: "Matchmaker · Select", href: "/matchmaker/select" },
  { label: "Intro detail", href: "/intro/1" },
  { label: "Chats", href: "/(tabs)/chats" },
  { label: "Chat thread", href: "/chat/1" },
  { label: "Intros", href: "/(tabs)/intros" },
  { label: "Profile", href: "/(tabs)/profile" },
];
```

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors in `app/_layout.tsx`, `components/home/TabBar.tsx`, or `components/dev/DevNav.tsx`

- [ ] **Step 5: Commit**

```bash
git add app/_layout.tsx components/home/TabBar.tsx components/dev/DevNav.tsx
git commit -m "feat: wire Matchmaker Step 1 into the FAB, modal stack, and dev nav"
```

- [ ] **Step 6: Manual verification**

This screen has no Supabase/auth dependency (mock data only), so it's safe to check in the web preview as well as a simulator.

Run: `npm run web` (or `npm run ios`)

In the running app:
1. Tap the DEV tab → "Matchmaker · Select" (or tap the center FAB from Home) — sheet should slide up with rounded top corners, drag handle, X button top-left, "STEP 1 OF 2" top-right.
2. Confirm the grid shows 3 visibly distinct chip states: full-opacity tappable chips, a 40%-opacity chip captioned "Hasn't opted in" (Theo Marsh), a 40%-opacity chip captioned "3 pending intros" (Ana Sousa).
3. Tap an eligible chip — coral ring + checkmark badge appears, headline changes to "Nice. Who's their match?".
4. Tap a second eligible chip — footer button enables, bounces, and its label reads "Continue with `<First>` & `<Second>`" using the two selected first names in tap order.
5. Tap a third eligible chip — selection unchanged, chip shakes, and a distinct (warning-style) haptic fires (haptics aren't visible in web preview — verify this step on a simulator/device instead).
6. Type in the search box — grid filters by name live.
7. Tap X — sheet dismisses back to Home.

Report any visual mismatch against `docs/superpowers/specs/2026-07-09-matchmaker-step1-friend-picker-design.md` before considering the screen done — do not mark this task complete on typecheck/lint alone.

---
