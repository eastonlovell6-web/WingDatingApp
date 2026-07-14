# Discover + Request an Intro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the two missing Flow 2 screens — `app/(tabs)/discover.tsx` (browse friends-of-friends) and `app/request/[friendId].tsx` (send a real intro request through a chosen mutual friend) — per `docs/superpowers/specs/2026-07-14-discover-request-intro-design.md`.

**Architecture:** Discover is a new mock-data screen (`components/discover/mockDiscoverPeople.ts` + `DiscoverPersonCard`) reached via a new icon in `HomeHeader`, registered as a tab-group route hidden from the tab bar. Tapping a card pushes `request/[friendId]`, a bottom-sheet screen (matching `matchmaker/note.tsx`'s chrome) that calls the **already-existing** `requestIntroduction()` (`lib/introductions.ts`) and `request-introduction` Edge Function — no backend changes. Two small shared-code improvements ride along: `SendConfirmationOverlay` gains an optional `message` prop, and `note.tsx`'s error-extraction helper moves to `lib/introductions.ts` so the new screen doesn't fork it.

**Tech Stack:** Expo Router (file-based routing, modal presentation for the request sheet), React Native Reanimated, `expo-haptics`, `react-native-svg`.

**No test runner exists in this repo** (`package.json` has only `typecheck` and `lint` scripts, no jest/vitest, no `*.test.*` files). Every task below uses `npx tsc --noEmit` as the automated correctness gate, per the project's actual convention. Tasks that produce visible UI also include a manual verification checklist — run these by hand with `npx expo start --web`.

## Global Constraints

- Design tokens only from `constants/colors.ts`, `constants/typography.ts`, `constants/spacing.ts`, `constants/elevation.ts` — no new hex values, no magic spacing numbers.
- All imports are relative (e.g. `../../constants/colors`), matching every existing file in this repo — no `@/` alias.
- Discover must only ever show people with `lookingToGetSetUp === true`, filtered at the data-read boundary (`getDiscoverPeople()`), not just visually.
- Discover people use fresh mock ids (`d1`, `d2`, ...) — never the viewer's own friend ids (`1`–`7` in `friendsMock.ts`), since Discover never shows people already in the viewer's friend list.
- No changes to `supabase/functions/request-introduction/index.ts` or `supabase/sql/*` — that backend already exists and already works; this plan is UI-only.
- No anti-spam cap UI and no Intros-tab "Requested" section — both are explicitly out of scope for this plan (see spec's "Out of scope").
- Exact copy: the request screen's send confirmation is `"Your request is on its way"` (not a paraphrase of the existing `"Your intro is on its way"`).
- Keep files under 500 lines.
- Every new screen gets an entry added to `components/dev/DevNav.tsx`'s `ROUTES` array, per this repo's established convention (every prior screen-adding plan does this).

---

### Task 1: Discover mock data

**Files:**
- Create: `components/discover/mockDiscoverPeople.ts`

**Interfaces:**
- Produces: `DiscoverPerson` type (`id, name, meta, photos: string[], mutualFriendIds: string[], lookingToGetSetUp: boolean`), `getDiscoverPeople(): DiscoverPerson[]`. Consumed by Task 3 (`discover.tsx`) and Task 7 (`request/[friendId].tsx`).

- [ ] **Step 1: Create `components/discover/mockDiscoverPeople.ts`**

```ts
export interface DiscoverPerson {
  id: string;
  name: string;
  meta: string;
  photos: string[];
  // ids into components/home/friendsMock.ts's MOCK_FRIENDS — which of the
  // viewer's own friends connect them to this person.
  mutualFriendIds: string[];
  // Same semantics as FriendProfile's flag: false = not open to being set
  // up right now. Gates whether this person can ever appear in Discover at
  // all, enforced by getDiscoverPeople() below, not just visually.
  lookingToGetSetUp: boolean;
}

// Throwaway fixture data until friends-of-friends are wired to Supabase.
// IDs are distinct from the viewer's own friends ("1"-"7" in friendsMock.ts/
// mockMatchmakerFriends.ts/mockFriendProfiles.ts) — Discover never shows
// people already in the viewer's friend list.
export const MOCK_DISCOVER_PEOPLE: DiscoverPerson[] = [
  {
    id: "d1",
    name: "Elena Cho",
    meta: "24 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=15"],
    mutualFriendIds: ["1"],
    lookingToGetSetUp: true,
  },
  {
    id: "d2",
    name: "Marcus Webb",
    meta: "25 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=25"],
    mutualFriendIds: ["2", "3"],
    lookingToGetSetUp: true,
  },
  {
    id: "d3",
    name: "Grace Kim",
    meta: "23 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=35"],
    mutualFriendIds: ["4"],
    lookingToGetSetUp: true,
  },
  {
    id: "d4",
    name: "Owen Bryant",
    meta: "24 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=55"],
    mutualFriendIds: ["5", "6", "7"],
    lookingToGetSetUp: true,
  },
  {
    id: "d5",
    name: "Talia Ross",
    meta: "22 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=65"],
    // Solely a wingman right now — must never surface as a requestable
    // target. Exercises the getDiscoverPeople() filter below.
    mutualFriendIds: ["3"],
    lookingToGetSetUp: false,
  },
];

export function getDiscoverPeople(): DiscoverPerson[] {
  return MOCK_DISCOVER_PEOPLE.filter((person) => person.lookingToGetSetUp);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/discover/mockDiscoverPeople.ts
git commit -m "feat: add Discover mock fixture data"
```

---

### Task 2: `DiscoverPersonCard` component

**Files:**
- Create: `components/discover/DiscoverPersonCard.tsx`

**Interfaces:**
- Consumes: `DiscoverPerson` type from `./mockDiscoverPeople`, `WingFriend` type from `../home/friendsMock`, `Badge` from `../ui/Badge` (props: `label, variant?, tone?, textColor?`).
- Produces: `DiscoverPersonCard` component, props `{ person: DiscoverPerson; mutuals: WingFriend[]; index: number }`. Consumed by Task 3.

- [ ] **Step 1: Create `components/discover/DiscoverPersonCard.tsx`**

```tsx
import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Badge } from "../ui/Badge";
import { ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { elevation } from "../../constants/elevation";
import type { DiscoverPerson } from "./mockDiscoverPeople";
import type { WingFriend } from "../home/friendsMock";

interface DiscoverPersonCardProps {
  person: DiscoverPerson;
  mutuals: WingFriend[];
  index: number;
}

const spring = { mass: 0.4, damping: 12, stiffness: 220 };

function mutualCaption(mutuals: WingFriend[]): string {
  if (mutuals.length === 0) return "";
  const firstName = mutuals[0].name.split(" ")[0];
  return mutuals.length === 1 ? `via ${firstName}` : `via ${firstName} +${mutuals.length - 1}`;
}

export function DiscoverPersonCard({ person, mutuals, index }: DiscoverPersonCardProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const mutualIds = mutuals.map((m) => m.id).join(",");
    router.push(`/request/${person.id}?mutualIds=${mutualIds}` as never);
  }

  return (
    <Animated.View entering={FadeInDown.duration(250).delay(index * 60)}>
      <Pressable
        onPressIn={() => (scale.value = withSpring(0.98, spring))}
        onPressOut={() => (scale.value = withSpring(1, spring))}
        onPress={handlePress}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${person.name}, ${mutualCaption(mutuals)}`}
      >
        <Animated.View style={[elevation.sm, animatedStyle, { gap: spacing[2] }]}>
          <View style={{ borderRadius: radii.xl, overflow: "hidden", aspectRatio: 4 / 5 }}>
            <Image source={{ uri: person.photos[0] }} style={{ width: "100%", height: "100%" }} />
          </View>
          <View style={{ gap: 2 }}>
            <Text
              style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.base[0], color: ink[900] }}
              numberOfLines={1}
            >
              {person.name.split(" ")[0]}
            </Text>
            <Text
              style={{ fontFamily: fonts.body, fontSize: fontSize.sm[0], color: ink[500] }}
              numberOfLines={1}
            >
              {person.meta}
            </Text>
            <Badge label={mutualCaption(mutuals)} tone="plum" />
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export default DiscoverPersonCard;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/discover/DiscoverPersonCard.tsx
git commit -m "feat: add DiscoverPersonCard component"
```

---

### Task 3: `app/(tabs)/discover.tsx` screen + hidden tab registration

**Files:**
- Create: `app/(tabs)/discover.tsx`
- Modify: `app/(tabs)/_layout.tsx`

**Interfaces:**
- Consumes: `getDiscoverPeople` (Task 1), `DiscoverPersonCard` (Task 2), `MOCK_FRIENDS` from `../../components/home/friendsMock`.
- No exports consumed elsewhere — this is a route, not a library module.

- [ ] **Step 1: Create `app/(tabs)/discover.tsx`**

```tsx
import { useState } from "react";
import { LayoutChangeEvent, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { DiscoverPersonCard } from "../../components/discover/DiscoverPersonCard";
import { getDiscoverPeople } from "../../components/discover/mockDiscoverPeople";
import { MOCK_FRIENDS } from "../../components/home/friendsMock";
import { ink, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

const COLUMNS = 2;

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 8 12l7 7" stroke={ink[900]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const [containerWidth, setContainerWidth] = useState(0);
  const people = getDiscoverPeople();
  const gap = spacing[4];
  const cardWidth = containerWidth > 0 ? (containerWidth - gap * (COLUMNS - 1)) / COLUMNS : 0;

  function handleLayout(event: LayoutChangeEvent) {
    setContainerWidth(event.nativeEvent.layout.width);
  }

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      <View
        style={{
          paddingTop: insets.top + spacing[2],
          paddingBottom: spacing[2],
          paddingHorizontal: spacing[4],
        }}
      >
        <Pressable
          onPress={() => router.canGoBack() && router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
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
        <Text
          style={{
            fontFamily: fonts.displaySemibold,
            fontSize: fontSize["2xl"][0],
            lineHeight: fontSize["2xl"][1],
            color: ink[900],
          }}
        >
          Discover
        </Text>

        {people.length === 0 ? (
          <Text style={{ fontFamily: fonts.body, fontSize: fontSize.base[0], color: ink[500] }}>
            No one to discover right now — check back once your friends make more connections.
          </Text>
        ) : (
          <View onLayout={handleLayout} style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
            {people.map((person, index) => {
              const mutuals = MOCK_FRIENDS.filter((friend) => person.mutualFriendIds.includes(friend.id));
              return (
                <View key={person.id} style={{ width: cardWidth || undefined }}>
                  <DiscoverPersonCard person={person} mutuals={mutuals} index={index} />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 2: Hide the route from the tab bar in `app/(tabs)/_layout.tsx`**

Add one line inside the existing `<Tabs>` element, after the last `<Tabs.Screen>`:

```tsx
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="discover" options={{ href: null }} />
```

`href: null` is Expo Router's documented way to include a screen inside a `Tabs` navigator's routing without giving it a tab bar button — Discover stays reachable via `router.push`, the 4-tab bar (For You, Intros, Chats, You) is unchanged.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/discover.tsx" "app/(tabs)/_layout.tsx"
git commit -m "feat: build Discover screen"
```

---

### Task 4: Wire the Discover entry point + DevNav

**Files:**
- Modify: `components/home/HomeHeader.tsx`
- Modify: `app/(tabs)/index.tsx`
- Modify: `components/dev/DevNav.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `HomeHeader`'s `onDiscoverPress?: () => void` prop, consumed by `app/(tabs)/index.tsx`.

- [ ] **Step 1: Add a Discover icon button to `components/home/HomeHeader.tsx`**

Change the import line:

```tsx
import { Text, View } from "react-native";
```

to:

```tsx
import { Pressable, Text, View } from "react-native";
```

Add this import alongside the existing ones (`Animated`, `Button`, `WingMark`, etc.):

```tsx
import Svg, { Circle, Path } from "react-native-svg";
```

Add `onDiscoverPress` to the props interface:

```tsx
interface HomeHeaderProps {
  name?: string;
  loading?: boolean;
  subhead?: string;
  onInvitePress?: () => void;
  onDiscoverPress?: () => void;
}
```

Add this function above `export function HomeHeader`:

```tsx
function DiscoverIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7" stroke={ink[900]} strokeWidth={2} />
      <Path d="M21 21l-4.3-4.3" stroke={ink[900]} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
```

Update the function signature to destructure the new prop:

```tsx
export function HomeHeader({ name, loading, subhead, onInvitePress, onDiscoverPress }: HomeHeaderProps) {
```

Replace the existing `<Button title="Invite" .../>` element with:

```tsx
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
          <Pressable
            onPress={onDiscoverPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Discover"
          >
            <DiscoverIcon />
          </Pressable>
          <Button
            title="Invite"
            variant="outline"
            onPress={onInvitePress}
            style={{ height: 44, paddingHorizontal: 16, borderColor: plum[100] }}
          />
        </View>
```

- [ ] **Step 2: Wire it in `app/(tabs)/index.tsx`**

Add to the existing `expo-router` import:

```tsx
import { router } from "expo-router";
```

(Note: `app/(tabs)/index.tsx` doesn't currently import from `expo-router` at all — add this as a new import line near the other imports.)

Update the `HomeHeader` element:

```tsx
        <HomeHeader
          name={name}
          loading={!!userId && isLoading}
          subhead={introSubhead}
          onDiscoverPress={() => router.push("/discover" as never)}
        />
```

- [ ] **Step 3: Add Discover + Request intro to `components/dev/DevNav.tsx`'s `ROUTES`**

Insert two entries right after the `"Home"` entry:

```tsx
  { label: "Home", href: "/(tabs)" },
  { label: "Discover", href: "/discover" },
  { label: "Request intro", href: "/request/d1?mutualIds=1" },
  { label: "Friend profile", href: "/friend/1" },
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run: `npx expo start --web`

1. On the Home tab, a small circular "search" icon now appears to the left of the "Invite" button in the header.
2. Tap it — the Discover screen opens, showing a 2-column grid of photo cards (Elena Cho, Marcus Webb, Grace Kim, Owen Bryant). Talia Ross does **not** appear (her `lookingToGetSetUp: false` filters her out).
3. Each card shows a name, meta line, and a plum "via [Name]" badge — Marcus Webb's badge reads "via [name] +1" (two mutuals), Owen Bryant's reads "via [name] +2" (three mutuals).
4. Tapping a card currently throws/404s (expected — `request/[friendId].tsx` doesn't exist until Task 7). Tap the back chevron instead to confirm it returns to Home.
5. Open the DEV panel (bottom-right tab in dev builds) — "Discover" jumps straight to the grid.

- [ ] **Step 6: Commit**

```bash
git add components/home/HomeHeader.tsx "app/(tabs)/index.tsx" components/dev/DevNav.tsx
git commit -m "feat: wire Discover entry point into Home header"
```

---

**Checkpoint:** Discover is fully built and reachable end-to-end. Per this project's one-screen-at-a-time rule, pause here for review before continuing to the Request screen (Tasks 5-7).

---

### Task 5: `SendConfirmationOverlay` gains a `message` prop

**Files:**
- Modify: `components/matchmaker/SendConfirmationOverlay.tsx`

**Interfaces:**
- Produces: `SendConfirmationOverlay` props become `{ visible: boolean; onDismiss: () => void; message?: string }`, defaulting to the existing `"Your intro is on its way"` copy. Consumed unchanged by `app/matchmaker/note.tsx`; consumed with an override by Task 7.

- [ ] **Step 1: Add the prop**

Change:

```tsx
interface SendConfirmationOverlayProps {
  visible: boolean;
  onDismiss: () => void;
}
```

to:

```tsx
interface SendConfirmationOverlayProps {
  visible: boolean;
  onDismiss: () => void;
  message?: string;
}
```

Change:

```tsx
export function SendConfirmationOverlay({ visible, onDismiss }: SendConfirmationOverlayProps) {
```

to:

```tsx
export function SendConfirmationOverlay({
  visible,
  onDismiss,
  message = "Your intro is on its way",
}: SendConfirmationOverlayProps) {
```

Change the hardcoded text:

```tsx
        <Text
          style={{
            fontFamily: fonts.bodyMedium,
            fontSize: fontSize.base[0],
            color: ink[900],
            textAlign: "center",
          }}
        >
          Your intro is on its way
        </Text>
```

to:

```tsx
        <Text
          style={{
            fontFamily: fonts.bodyMedium,
            fontSize: fontSize.base[0],
            color: ink[900],
            textAlign: "center",
          }}
        >
          {message}
        </Text>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/matchmaker/SendConfirmationOverlay.tsx
git commit -m "refactor: generalize SendConfirmationOverlay's copy to a message prop"
```

---

### Task 6: Shared Edge Function error-extraction helper

**Files:**
- Modify: `lib/introductions.ts`
- Modify: `app/matchmaker/note.tsx`

**Interfaces:**
- Produces: `extractFunctionErrorMessage(err: unknown, fallback: string): Promise<string>`, exported from `lib/introductions.ts`. Consumed by `note.tsx` (this task) and Task 7.

- [ ] **Step 1: Add the helper to `lib/introductions.ts`**

Add this function after the imports, before `sendIntroduction`:

```ts
/**
 * supabase-js's FunctionsHttpError always has a generic .message ("Edge
 * Function returned a non-2xx status code") — the Edge Function's actual
 * JSON error body is only reachable via .context, a raw Response. Shared by
 * every screen that sends through an Edge Function and wants the real
 * server-side error surfaced instead of that generic string.
 */
export async function extractFunctionErrorMessage(err: unknown, fallback: string): Promise<string> {
  if (err && typeof err === "object" && "context" in err) {
    const context = (err as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json();
        if (typeof body?.error === "string") return body.error;
      } catch {
        // Fall through to the fallback below.
      }
    }
  }
  return err instanceof Error ? err.message : fallback;
}
```

- [ ] **Step 2: Remove the local copy from `app/matchmaker/note.tsx` and use the shared one**

Delete this whole block (the local helper function):

```tsx
/**
 * supabase-js's FunctionsHttpError always has a generic .message ("Edge
 * Function returned a non-2xx status code") — the Edge Function's actual
 * JSON error body is only reachable via .context, a raw Response. Same
 * detection pattern lib/introductions.ts's respondToIntroduction already
 * uses for its 409 check.
 */
async function extractSendErrorMessage(err: unknown): Promise<string> {
  if (err && typeof err === "object" && "context" in err) {
    const context = (err as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json();
        if (typeof body?.error === "string") return body.error;
      } catch {
        // Fall through to the generic message below.
      }
    }
  }
  return err instanceof Error ? err.message : "Couldn't send that intro. Try again.";
}
```

Change the import line:

```tsx
import { sendIntroduction } from "../../lib/introductions";
```

to:

```tsx
import { extractFunctionErrorMessage, sendIntroduction } from "../../lib/introductions";
```

Change the call site:

```tsx
      setSendError(await extractSendErrorMessage(err));
```

to:

```tsx
      setSendError(await extractFunctionErrorMessage(err, "Couldn't send that intro. Try again."));
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `npx expo start --web`

1. Go through the Matchmaker flow (FAB → select two friends → write a note → Send) — behavior is identical to before this refactor: confirmation overlay reads "Your intro is on its way", any error still shows the real server message.

- [ ] **Step 5: Commit**

```bash
git add lib/introductions.ts app/matchmaker/note.tsx
git commit -m "refactor: share Edge Function error-extraction helper"
```

---

### Task 7: `app/request/[friendId].tsx` screen

**Files:**
- Create: `app/request/[friendId].tsx`
- Modify: `app/_layout.tsx`
- Modify: `components/dev/DevNav.tsx`

**Interfaces:**
- Consumes: `getDiscoverPeople` (Task 1), `MOCK_FRIENDS`/`WingFriend` from `../../components/home/friendsMock`, `Avatar` from `../../components/ui/Avatar`, `Button` from `../../components/ui/Button`, `SendConfirmationOverlay` (Task 5, with `message` prop), `requestIntroduction`/`extractFunctionErrorMessage` from `../../lib/introductions` (Task 6).
- No exports consumed elsewhere — this is a route, not a library module.

- [ ] **Step 1: Create `app/request/[friendId].tsx`**

```tsx
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { SendConfirmationOverlay } from "../../components/matchmaker/SendConfirmationOverlay";
import { getDiscoverPeople } from "../../components/discover/mockDiscoverPeople";
import { MOCK_FRIENDS, type WingFriend } from "../../components/home/friendsMock";
import { extractFunctionErrorMessage, requestIntroduction } from "../../lib/introductions";
import { coral, ink, surface } from "../../constants/colors";
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

function MutualOption({
  friend,
  selected,
  onPress,
}: {
  friend: WingFriend;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={friend.name}
      accessibilityState={{ selected }}
    >
      <View style={{ alignItems: "center", gap: 6 }}>
        <View style={{ width: 60, height: 60, alignItems: "center", justifyContent: "center" }}>
          {selected && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 58,
                height: 58,
                borderRadius: radii.pill,
                borderWidth: 2.5,
                borderColor: coral[500],
              }}
            />
          )}
          <Avatar name={friend.name} size={52} imageUri={friend.imageUri} />
        </View>
        <Text style={{ fontFamily: fonts.body, fontSize: fontSize.sm[0], color: ink[900] }}>
          {friend.name.split(" ")[0]}
        </Text>
      </View>
    </Pressable>
  );
}

export default function RequestIntroScreen() {
  const { friendId, mutualIds } = useLocalSearchParams<{ friendId: string; mutualIds?: string }>();
  const insets = useSafeAreaInsets();
  const [selectedMutualId, setSelectedMutualId] = useState<string | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const person = getDiscoverPeople().find((p) => p.id === friendId);
  const mutualFriendIds = mutualIds ? mutualIds.split(",").filter(Boolean) : [];
  const mutuals = MOCK_FRIENDS.filter((friend) => mutualFriendIds.includes(friend.id));

  // Malformed/direct deep link — not reachable via the app's own navigation
  // (discover.tsx only ever passes a real person id + its own mutuals), so
  // this just backs out rather than showing a dedicated error state. Same
  // convention as matchmaker/note.tsx.
  useEffect(() => {
    if (!person || mutuals.length === 0) {
      router.canGoBack() && router.back();
    }
  }, [person, mutuals.length]);

  useEffect(() => {
    if (mutuals.length > 0 && !selectedMutualId) {
      setSelectedMutualId(mutuals[0].id);
    }
  }, [mutuals, selectedMutualId]);

  if (!person || mutuals.length === 0) {
    return null;
  }

  const selectedMutual = mutuals.find((m) => m.id === selectedMutualId) ?? mutuals[0];
  const targetFirstName = person.name.split(" ")[0];
  const mutualFirstName = selectedMutual.name.split(" ")[0];

  async function handleSend() {
    if (sending || confirming || !person || mutuals.length === 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    setSendError(null);
    try {
      await requestIntroduction(person.id, selectedMutual.id);
      setConfirming(true);
    } catch (err) {
      setSendError(await extractFunctionErrorMessage(err, "Couldn't send that request. Try again."));
    } finally {
      setSending(false);
    }
  }

  function handleConfirmationDismiss() {
    setConfirming(false);
    router.dismissTo("/(tabs)" as never);
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing[6] }}>
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
          <Text style={textStyles.eyebrow}>REQUEST AN INTRO</Text>
        </View>

        <View
          style={{
            alignItems: "center",
            paddingHorizontal: spacing[6],
            paddingTop: spacing[6],
            gap: spacing[4],
          }}
        >
          <View style={{ width: 120, height: 120, borderRadius: radii.pill, overflow: "hidden" }}>
            <Image source={{ uri: person.photos[0] }} style={{ width: "100%", height: "100%" }} />
          </View>
          <View style={{ alignItems: "center", gap: 2 }}>
            <Text style={textStyles.heading}>{person.name}</Text>
            <Text style={textStyles.caption}>{person.meta}</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing[6], paddingTop: spacing[8], gap: spacing[4] }}>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.sm[0], color: ink[500] }}>
            {mutuals.length === 1 ? "Through your mutual friend" : "Ask through"}
          </Text>
          <View style={{ flexDirection: "row", gap: spacing[4] }}>
            {mutuals.map((friend) => (
              <MutualOption
                key={friend.id}
                friend={friend}
                selected={friend.id === selectedMutual.id}
                onPress={() => setSelectedMutualId(friend.id)}
              />
            ))}
          </View>
        </View>
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
        {sendError && (
          <Text
            style={[textStyles.caption, { color: coral[500], textAlign: "center", marginBottom: spacing[2] }]}
          >
            {sendError}
          </Text>
        )}
        <Button
          title={`Ask ${mutualFirstName} to introduce you to ${targetFirstName}`}
          onPress={handleSend}
          disabled={confirming}
          loading={sending}
        />
      </View>

      <SendConfirmationOverlay
        visible={confirming}
        onDismiss={handleConfirmationDismiss}
        message="Your request is on its way"
      />
    </View>
  );
}
```

- [ ] **Step 2: Register the modal presentation in `app/_layout.tsx`**

`discover.tsx` pushes into this route from a plain (non-modal) screen, unlike `matchmaker/note.tsx` which is reached from within `matchmaker/select.tsx`'s existing modal stack — so this route needs its own explicit modal registration to get the slide-up sheet treatment.

Add a third `<Stack.Screen>` inside the existing `<Stack screenOptions={{ headerShown: false }}>` block in `app/_layout.tsx`:

```tsx
            <Stack.Screen
              name="matchmaker/prompt-friends"
              options={{ presentation: "modal", animation: "slide_from_bottom" }}
            />
            <Stack.Screen
              name="request/[friendId]"
              options={{ presentation: "modal", animation: "slide_from_bottom" }}
            />
```

- [ ] **Step 3: Add "Request intro" verification target to `components/dev/DevNav.tsx`**

Already added in Task 4, Step 3 — skip if that task already ran. If executing this task independently, insert:

```tsx
  { label: "Request intro", href: "/request/d1?mutualIds=1" },
```

right after the `"Discover"` entry.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run: `npx expo start --web`

1. From Home, tap the Discover icon, then tap Elena Cho's card (one mutual friend).
2. The request sheet slides up from the bottom with rounded top corners, a drag handle, and an X close button. Elena's photo/name/meta show at the top, one avatar chip ("Through your mutual friend") shows below with a coral selection ring already on it.
3. The button reads "Ask [mutual's first name] to introduce you to Elena".
4. Tap the button — after a brief loading spinner, a confirmation card reads "Your request is on its way", then auto-dismisses after ~1.5s back to Home.
5. Go back to Discover, tap Marcus Webb's card (two mutuals) — two avatar chips appear; tapping the second one moves the selection ring and updates the button's mutual name.
6. Tap X instead of sending — returns to Discover.
7. In the Intros tab, confirm nothing changed there (this plan explicitly doesn't touch it) — no "Requested" section appears.

- [ ] **Step 6: Commit**

```bash
git add "app/request/[friendId].tsx" app/_layout.tsx components/dev/DevNav.tsx
git commit -m "feat: build Request an Intro screen"
```
