# Friend Profile Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Friend Profile screen (spec section 2a of
`docs/superpowers/specs/2026-07-12-request-an-intro-design.md`) — a read-only
view of a friend's photos/prompts reached by tapping their avatar, with two
actions: jump into the matchmaker flow with them preselected, or (stubbed for
now) see who they could introduce you to.

**Architecture:** New route `app/friend/[friendId].tsx` composed of two new
read-only presentational components (`FriendProfileHeader`,
`FriendPhotoPromptPanel`) and a new mock data source
(`components/friend/mockFriendProfiles.ts`). Wires into the app via three
small edits: `FriendsRow`'s existing tap-through TODO, a `preselect` query
param on the existing matchmaker select screen, and a DevNav shortcut.

**Tech Stack:** Expo Router (file-based, `useLocalSearchParams`), React
Native + NativeWind-adjacent inline styles (this codebase styles via
`constants/colors.ts` / `spacing.ts` / `typography.ts` tokens passed directly
to `style` props, not className), React Native Reanimated/Haptics (used
inside the reused `Button`/`Avatar` components only — no new gesture code
needed here).

## Global Constraints

- Design tokens only — no hardcoded hex/px values; import from
  `constants/colors.ts`, `constants/spacing.ts`, `constants/typography.ts`.
- Friend Profile is reached "wherever a friend avatar appears" — this plan
  wires the one existing case (`FriendsRow`).
- "See who [Name] could introduce you to" is only rendered when that friend's
  visibility settings permit it; "Introduce [Name] to someone" only when
  they're opted in to being introduced. Neither is disabled-and-shown —
  absent means omitted, matching the app's existing convention (e.g. how
  `FriendPickerChip` handles ineligibility differently, but the *omission*
  pattern itself mirrors how optional UI is hidden rather than disabled
  elsewhere in this codebase).
- Always name the friend in copy (e.g. "Introduce Maya to someone," never
  "Introduce a friend to someone") — per CLAUDE.md voice/tone rules.
- Keep files under 500 lines.
- Read a file before editing it.
- **No test runner is configured in this project** (no jest/testing-library,
  no `test` script in `package.json`). Every task's verification is
  `npx tsc --noEmit` (must pass with zero new errors) plus a manual
  walk-through by running the app.

---

### Task 1: Mock friend profile data

**Files:**
- Create: `components/friend/mockFriendProfiles.ts`

**Interfaces:**
- Consumes: `ProfilePrompt` type from `components/profile/mockProfile.ts`
  (`{ question: string; answer: string }`).
- Produces: `FriendProfile` interface and `MOCK_FRIEND_PROFILES: Record<string, FriendProfile>`,
  keyed by the same ids ("1"–"7") used in `components/home/friendsMock.ts`
  and `components/matchmaker/mockMatchmakerFriends.ts`, for later tasks to
  look up by `friendId`.

- [ ] **Step 1: Create the mock data file**

```ts
import type { ProfilePrompt } from "../profile/mockProfile";

export interface FriendProfile {
  id: string;
  name: string;
  meta: string;
  photos: string[];
  prompts: ProfilePrompt[];
  // Mirrors friendships.can_introduce for this friend — gates the
  // "Introduce [Name] to someone" action.
  canIntroduce: boolean;
  // Mirrors this friend's own visibility setting on being asked about via
  // Request an Intro — gates "See who [Name] could introduce you to".
  connectionsVisible: boolean;
}

// Throwaway fixture data until friend profiles are wired to Supabase. IDs
// and names match components/home/friendsMock.ts and
// components/matchmaker/mockMatchmakerFriends.ts.
export const MOCK_FRIEND_PROFILES: Record<string, FriendProfile> = {
  "1": {
    id: "1",
    name: "Sam Rivera",
    meta: "23 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=11", "https://i.pravatar.cc/400?img=12"],
    prompts: [
      { question: "I will never turn down...", answer: "A pickup game of pickleball, any time of day." },
    ],
    canIntroduce: true,
    connectionsVisible: true,
  },
  "2": {
    id: "2",
    name: "Priya Nair",
    meta: "24 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=21"],
    prompts: [
      {
        question: "The last thing that made me laugh out loud was...",
        answer: "My little sister's audition tape for a cooking show.",
      },
    ],
    canIntroduce: true,
    connectionsVisible: true,
  },
  "3": {
    id: "3",
    name: "Jordan Blake",
    meta: "22 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=31", "https://i.pravatar.cc/400?img=32"],
    prompts: [
      { question: "Ask me about the time I...", answer: "Talked my way onto a closed ski lift in a snowstorm." },
    ],
    canIntroduce: true,
    connectionsVisible: false,
  },
  "4": {
    id: "4",
    name: "Maya Chen",
    meta: "23 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=41"],
    prompts: [
      { question: "I'm weirdly competitive about...", answer: "Trivia night. I keep a running scoreboard on my fridge." },
    ],
    canIntroduce: true,
    connectionsVisible: true,
  },
  "5": {
    id: "5",
    name: "Theo Marsh",
    meta: "25 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=51"],
    prompts: [
      { question: "I could talk for an hour about...", answer: "Why the 1997 Jazz should've won it all." },
    ],
    canIntroduce: false,
    connectionsVisible: true,
  },
  "6": {
    id: "6",
    name: "Ana Sousa",
    meta: "22 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=61", "https://i.pravatar.cc/400?img=62"],
    prompts: [
      {
        question: "My friends would describe me in three words as...",
        answer: "Loud, loyal, chronically late.",
      },
    ],
    canIntroduce: true,
    connectionsVisible: true,
  },
  "7": {
    id: "7",
    name: "Kai Fischer",
    meta: "24 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=71"],
    prompts: [
      {
        question: "A skill I'm proud of that has zero practical use...",
        answer: "I can solve a Rubik's cube behind my back.",
      },
    ],
    canIntroduce: true,
    connectionsVisible: false,
  },
};
```

Note the deliberate mix: Theo (`5`) has `canIntroduce: false` (exercises the
hidden "Introduce" button case), Jordan (`3`) and Kai (`7`) have
`connectionsVisible: false` (exercises the hidden "See who..." button case).
Every other friend has both actions visible.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add components/friend/mockFriendProfiles.ts
git commit -m "feat: add mock friend profile data"
```

---

### Task 2: Read-only profile components

**Files:**
- Create: `components/friend/FriendProfileHeader.tsx`
- Create: `components/friend/FriendPhotoPromptPanel.tsx`

**Interfaces:**
- Consumes: `ProfilePrompt` from `components/profile/mockProfile.ts`;
  `Avatar` from `components/ui/Avatar.tsx` (`{ name, imageUri?, size? }`).
- Produces: `FriendProfileHeader({ name, meta, avatarUri }: { name: string; meta: string; avatarUri?: string })`
  and `FriendPhotoPromptPanel({ photos, prompts }: { photos: string[]; prompts: ProfilePrompt[] })`,
  both consumed by Task 3's screen.

These intentionally do **not** reuse `components/profile/ProfileHeader.tsx`
or `components/profile/PhotoPromptPanel.tsx` — those components require
edit/upload callbacks as non-optional props and always render pencil icons
and an "Add a prompt" / add-photo slot. Making them conditionally editable
would bloat two already-focused files; a friend's profile has no editing
surface at all, so a small dedicated read-only pair is simpler than adding
optional-prop branches to the editable ones.

- [ ] **Step 1: Create the read-only header**

```tsx
import { Text, View } from "react-native";
import { Avatar } from "../ui/Avatar";
import { ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

interface FriendProfileHeaderProps {
  name: string;
  meta: string;
  avatarUri?: string;
}

export function FriendProfileHeader({ name, meta, avatarUri }: FriendProfileHeaderProps) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[4] }}>
      <Avatar name={name} imageUri={avatarUri} size={72} />
      <View style={{ gap: 2, flexShrink: 1 }}>
        <Text
          style={{
            fontFamily: fonts.displaySemibold,
            fontSize: fontSize["2xl"][0],
            lineHeight: fontSize["2xl"][1],
            letterSpacing: -0.2,
            color: ink[900],
          }}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.sm[0],
            lineHeight: fontSize.sm[1],
            color: ink[500],
          }}
          numberOfLines={1}
        >
          {meta}
        </Text>
      </View>
    </View>
  );
}

export default FriendProfileHeader;
```

- [ ] **Step 2: Create the read-only photo/prompt panel**

```tsx
import { useState } from "react";
import {
  Image,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  View,
} from "react-native";
import { coral, ink, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import type { ProfilePrompt } from "../profile/mockProfile";

function CarouselDots({ count, activeIndex }: { count: number; activeIndex: number }) {
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

function ReadOnlyPhotoCarousel({ photos }: { photos: string[] }) {
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
    <View onLayout={handleLayout} style={{ gap: spacing[2] }}>
      {containerWidth > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
        >
          {photos.map((uri, i) => (
            <View key={`${uri}-${i}`} style={{ width: containerWidth, aspectRatio: 4 / 5, padding: 2 }}>
              <Image source={{ uri }} style={{ width: "100%", height: "100%", borderRadius: radii.lg }} />
            </View>
          ))}
        </ScrollView>
      )}
      <CarouselDots count={photos.length} activeIndex={activeIndex} />
    </View>
  );
}

function ReadOnlyPromptCard({ prompt }: { prompt: ProfilePrompt }) {
  return (
    <View
      style={{
        backgroundColor: surface.paper,
        borderRadius: radii.lg,
        padding: spacing[4],
        gap: spacing[2],
        shadowColor: shadowTint,
        shadowOpacity: 1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.body,
          fontSize: fontSize.sm[0],
          lineHeight: fontSize.sm[1],
          color: ink[500],
        }}
      >
        {prompt.question}
      </Text>
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: fontSize.xl[0],
          lineHeight: fontSize.xl[1],
          letterSpacing: -0.2,
          color: ink[900],
        }}
      >
        {prompt.answer}
      </Text>
    </View>
  );
}

interface FriendPhotoPromptPanelProps {
  photos: string[];
  prompts: ProfilePrompt[];
}

export function FriendPhotoPromptPanel({ photos, prompts }: FriendPhotoPromptPanelProps) {
  return (
    <View style={{ gap: spacing[6] }}>
      <ReadOnlyPhotoCarousel photos={photos} />
      <View style={{ gap: spacing[4] }}>
        {prompts.map((prompt, i) => (
          <ReadOnlyPromptCard key={i} prompt={prompt} />
        ))}
      </View>
    </View>
  );
}

export default FriendPhotoPromptPanel;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/friend/FriendProfileHeader.tsx components/friend/FriendPhotoPromptPanel.tsx
git commit -m "feat: add read-only friend profile header and photo/prompt panel"
```

---

### Task 3: Friend Profile screen

**Files:**
- Create: `app/friend/[friendId].tsx`

**Interfaces:**
- Consumes: `MOCK_FRIEND_PROFILES` from Task 1; `FriendProfileHeader`,
  `FriendPhotoPromptPanel` from Task 2; `Button` from
  `components/ui/Button.tsx` (`{ title, onPress, variant? }`).
- Produces: route `/friend/[friendId]`, consumed by Task 4's wiring.

No explicit `Stack.Screen` entry is needed in `app/_layout.tsx` — Expo
Router auto-registers file-based routes with the default
`screenOptions={{ headerShown: false }}` already set there (same as the
existing `app/chat/[id].tsx` and `app/intro/[id].tsx`, neither of which has
a `Stack.Screen` override either).

- [ ] **Step 1: Create the screen**

```tsx
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { Button } from "../../components/ui/Button";
import { FriendProfileHeader } from "../../components/friend/FriendProfileHeader";
import { FriendPhotoPromptPanel } from "../../components/friend/FriendPhotoPromptPanel";
import { MOCK_FRIEND_PROFILES } from "../../components/friend/mockFriendProfiles";
import { ink, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 8 12l7 7" stroke={ink[900]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Same stub convention as components/profile/mockProfile.ts's comingSoon()
// helper in app/(tabs)/profile.tsx — used here until the Connections List
// screen (spec section 2b) is built in a later plan.
function comingSoon(title: string) {
  Alert.alert(title, "This screen isn't built yet — hang tight.");
}

export default function FriendProfileScreen() {
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const insets = useSafeAreaInsets();
  const friend = friendId ? MOCK_FRIEND_PROFILES[friendId] : undefined;

  if (!friend) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: surface.cream,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing[6],
        }}
      >
        <Text style={{ fontFamily: fonts.body, fontSize: fontSize.base[0], color: ink[500] }}>
          Couldn&apos;t find that friend.
        </Text>
      </View>
    );
  }

  const firstName = friend.name.split(" ")[0];

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      <View
        style={{
          paddingTop: insets.top + spacing[2],
          paddingBottom: spacing[2],
          paddingHorizontal: spacing[4],
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <BackIcon />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing[6],
          paddingTop: spacing[2],
          paddingBottom: insets.bottom + spacing[8],
          gap: spacing[6],
        }}
        showsVerticalScrollIndicator={false}
      >
        <FriendProfileHeader name={friend.name} meta={friend.meta} avatarUri={friend.photos[0]} />
        <FriendPhotoPromptPanel photos={friend.photos} prompts={friend.prompts} />

        <View style={{ gap: spacing[4] }}>
          {friend.canIntroduce && (
            <Button
              title={`Introduce ${firstName} to someone`}
              onPress={() => router.push(`/matchmaker/select?preselect=${friend.id}` as never)}
            />
          )}
          {friend.connectionsVisible && (
            <Button
              title={`See who ${firstName} could introduce you to`}
              variant="outline"
              onPress={() => comingSoon(`${firstName}'s connections`)}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual verification**

Run: `npx expo start`, open in the iOS simulator (per the RN-Web preview
gotchas already on file for this project — don't verify against the web
target).

Since nothing links to `/friend/[friendId]` yet, navigate directly by typing
a URL in the simulator's dev menu, or temporarily append `router.push("/friend/1")`
to a button's `onPress` — remove any temporary navigation hook before
committing. Confirm:
- Sam Rivera's name, meta, photos (paged, swipeable, dots update), and
  prompt render.
- Both "Introduce Sam to someone" and "See who Sam could introduce you to"
  buttons are visible (id `1` has both flags `true`).
- Tapping "Introduce Sam to someone" opens the matchmaker select modal.
- Tapping "See who Sam could introduce you to" shows the "isn't built yet"
  alert.
- Load id `5` (Theo Marsh, `canIntroduce: false`) — only the "See who..."
  button renders. Load id `3` (Jordan Blake, `connectionsVisible: false`) —
  only the "Introduce..." button renders.
- Back arrow returns to the previous screen.

- [ ] **Step 4: Commit**

```bash
git add app/friend/\[friendId\].tsx
git commit -m "feat: add Friend Profile screen"
```

---

### Task 4: Wire entry points into the app

**Files:**
- Modify: `components/home/FriendsRow.tsx:20-22`
- Modify: `app/matchmaker/select.tsx:1-4,40-44`
- Modify: `components/dev/DevNav.tsx:21-34`

**Interfaces:**
- Consumes: route `/friend/[friendId]` (Task 3), `router` from `expo-router`.
- Produces: nothing new consumed by later tasks — this is the terminal
  wiring task for this plan.

- [ ] **Step 1: Wire `FriendsRow` to open the Friend Profile screen**

In `components/home/FriendsRow.tsx`, add the import and replace the no-op
handler. This changes what tapping a friend avatar does today — the old TODO
comment suggested jumping straight into the matchmaker flow, but per the
Request an Intro design, avatars now open the Friend Profile screen first,
which itself offers "Introduce to someone" as one of two actions.

```ts
import { router } from "expo-router";
```

Add this import alongside the existing `react-native`/`expo-*` imports at
the top of the file, then replace:

```ts
function handleFriendPress(_friendId: string) {
  // TODO: router.push(`/matchmaker/select?preselect=${friendId}`)
}
```

with:

```ts
function handleFriendPress(friendId: string) {
  router.push(`/friend/${friendId}` as never);
}
```

- [ ] **Step 2: Add `preselect` query param support to matchmaker select**

In `app/matchmaker/select.tsx`, change the import line:

```ts
import { router } from "expo-router";
```

to:

```ts
import { router, useLocalSearchParams } from "expo-router";
```

Then inside `MatchmakerSelectScreen`, read the param and seed initial
selection state:

```ts
export default function MatchmakerSelectScreen() {
  const { preselect } = useLocalSearchParams<{ preselect?: string }>();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(() => (preselect ? [preselect] : []));
```

(Replaces the existing `const [selectedIds, setSelectedIds] = useState<string[]>([]);` line.)

- [ ] **Step 3: Add a DevNav shortcut**

In `components/dev/DevNav.tsx`, insert a new entry into `ROUTES` right after
`"Home"` (so the ◀ ▶ steppers walk Home → Friend profile → Matchmaker ·
Select, matching the real navigation order):

```ts
  { label: "Home", href: "/(tabs)" },
  { label: "Friend profile", href: "/friend/1" },
  { label: "Matchmaker · Select", href: "/matchmaker/select" },
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

Run: `npx expo start`, open in the iOS simulator.

- From Home, tap a friend avatar in the "On Wing" row → Friend Profile
  screen opens for that friend.
- From Friend Profile, tap "Introduce [Name] to someone" → matchmaker select
  modal opens with that friend already selected (coral ring + checkmark on
  their chip), and the Continue button is disabled (only one of two picked).
- Open the DEV panel (top-right tab) → "Friend profile" jumps to
  `/friend/1` (Sam Rivera).

- [ ] **Step 6: Commit**

```bash
git add components/home/FriendsRow.tsx app/matchmaker/select.tsx components/dev/DevNav.tsx
git commit -m "feat: wire Friend Profile into FriendsRow, matchmaker preselect, and dev nav"
```

---

## Out of scope (later plans)

- Connections list screen (spec 2b), request confirmation sheet (2c), and
  the Intros tab Sent/Requested restructure (2d) — each becomes its own plan
  once this one is reviewed and approved, per the project's one-screen-at-a-
  time build philosophy.
- Nudge mechanic (spec 3) and anti-spam caps (spec 4) — depend on the
  `intro_requests` data model existing, which no plan has created yet.
- No Supabase wiring — `MOCK_FRIEND_PROFILES` stays static, matching the
  fidelity of every other mock data file in this codebase today.
