# Home Screen ("For You" Tab) Design Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 10 regressions on the Home ("For You") tab found in a 5-lens design review — restore the intro card's signature gradient, differentiate the hero intro from secondary ones, cut dead space, stop teasing the note text, bring plum into the two most trust-critical surfaces, add a real elevation system, fix the FAB/nav-bar collision, fix the clipped DEV badge, add a scroll affordance to the friends row, and add a contextual subhead.

**Architecture:** A new `constants/elevation.ts` provides 6 warm-tinted shadow tiers, consumed by `IntroPreviewCard` (cards) and `TabBar` (nav pill + FAB) so both get correctly differentiated depth. `IntroPreviewCard.tsx` gains a `variant: "hero" | "stack"` prop so the same component renders either the full-detail gradient card (most recent intro) or a compact white row (additional pending intros) — `IntroFeed.tsx` composes exactly one hero + up to two stack cards. `TabBar.tsx`, `components/dev/DevNav.tsx`, and `components/home/FriendsRow.tsx` get small, independent positioning/token fixes. `HomeHeader.tsx` gains an optional `subhead` prop computed in `app/(tabs)/index.tsx` from the mock intro data.

**Tech Stack:** Expo (React Native) SDK 52+, TypeScript strict, React Native Reanimated 3, expo-linear-gradient, expo-haptics — all already in use. No new dependencies.

## Global Constraints

- Gradients (`constants/colors.ts` → `gradients`) are reserved for hero moments only. `gradients.sunset` (coral→blush) is the intro-note-card gradient per the design doc — `gradients.ember` (the near-flat coral-to-coral pairing currently on the card) is a regression, not an intentional variant.
- Plum (`plum[100]/300/500/600`) signals trust / mutual-friend context — reserve any new plum usage for that meaning, not decoration.
- Coral (`coral[500]`) stays reserved for primary action / CTA / active-state meaning.
- All spacing from the 4px scale in `constants/spacing.ts` (`spacing[2]`=8, `spacing[4]`=16, `spacing[6]`=24, `spacing[8]`=40, `spacing[10]`=64) — no magic numbers.
- Radii from `constants/spacing.ts` `radii` — the intro-note (hero) card keeps `radii.xl` (28px) per the design doc; do not change it.
- Shadows use the warm `shadowTint` from `constants/colors.ts` (never pure black) — this plan formalizes that into `constants/elevation.ts`.
- Three fonts, one job each: `fonts.display`/`fonts.displaySemibold` (Bricolage) for headlines/note text, `fonts.body`/`fonts.bodyMedium` (DM Sans) for reading text/UI copy, `fonts.mono`/`fonts.monoMedium` (DM Mono) for uppercase eyebrow labels.
- Keep files under 500 lines.
- No automated test runner exists in this repo (no jest, no `.test.` files) — verification per task is `npm run typecheck` + `npm run lint`, plus a final manual pass in the running app (Task 8).
- Do not touch: cream background, coral-only CTA discipline in the nav, mono eyebrow labels, friend-named copy conventions, `components/ui/Button.tsx`, `components/ui/Avatar.tsx`'s public API.

---

### Task 1: Elevation system foundation

**Files:**
- Create: `constants/elevation.ts`

**Interfaces:**
- Produces: `elevation.xs | .sm | .md | .lg | .xl | .brand` (each a `ViewStyle`) — consumed by Task 2 (`IntroPreviewCard`) and Task 4 (`TabBar`).

- [ ] **Step 1: Create the elevation tiers**

Create `constants/elevation.ts`:

```ts
/**
 * Wing elevation tokens — canonical source of truth.
 *
 * 6 warm-tinted shadow tiers (never pure black — see `shadowTint` in
 * colors.ts). Higher tiers = higher in the visual stack: xs/sm/md are
 * resting-surface tiers (compact rows → hero cards → modals/panels), lg/xl
 * are floating-chrome tiers (nav pill → topmost chrome), and `brand` is the
 * coral-glow tier reserved for the FAB / primary CTA so it reads as the
 * single most elevated element on screen.
 */

import type { ViewStyle } from 'react-native';
import { coral, shadowTint } from './colors';

export const elevation: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'brand', ViewStyle> = {
  // Compact list rows — FriendsRow chips, IntroPreviewCard "stack" variant.
  xs: {
    shadowColor: shadowTint,
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  // Standard resting cards — IntroPreviewCard "hero" variant.
  sm: {
    shadowColor: shadowTint,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  // Raised surfaces — modals, panels.
  md: {
    shadowColor: shadowTint,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  // Floating nav pill.
  lg: {
    shadowColor: shadowTint,
    shadowOpacity: 1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  // Topmost neutral floating chrome, above the nav pill.
  xl: {
    shadowColor: shadowTint,
    shadowOpacity: 1,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  // Coral-tinted glow reserved for the FAB / primary CTA — bigger + more
  // opaque than `lg` so the FAB visibly separates from the nav pill beneath it.
  brand: {
    shadowColor: coral[500],
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
};

export default elevation;
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add constants/elevation.ts
git commit -m "feat: add warm-tinted elevation token system"
```

---

### Task 2: IntroPreviewCard — restore gradient, hero/stack variants, inline avatar, full note

**Files:**
- Modify: `components/intro/IntroPreviewCard.tsx`

**Interfaces:**
- Consumes: `elevation.sm`, `elevation.xs` (Task 1).
- Produces: `IntroPreviewCardProps.variant?: "hero" | "stack"` (defaults to `"hero"`) — consumed by Task 3 (`IntroFeed`).

- [ ] **Step 1: Replace the whole file**

Replace the full contents of `components/intro/IntroPreviewCard.tsx` with:

```tsx
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Avatar } from "../ui/Avatar";
import { TruncatedText } from "../ui/TruncatedText";
import { coral, gradients, ink, plum, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { elevation } from "../../constants/elevation";
import type { IntroPreview } from "./mockIntros";

interface IntroPreviewCardProps {
  intro: IntroPreview;
  index: number;
  /** "hero" is the full-detail card for the most recent intro; "stack" is
   * the compact "next up" row for additional pending intros. */
  variant?: "hero" | "stack";
  onPress?: () => void;
}

const spring = { mass: 0.4, damping: 12, stiffness: 220 };

export function IntroPreviewCard({ intro, index, variant = "hero", onPress }: IntroPreviewCardProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: router.push(`/intro/${intro.id}`)
    onPress?.();
  }

  const pressHandlers = {
    onPressIn: () => (scale.value = withSpring(0.98, spring)),
    onPressOut: () => (scale.value = withSpring(1, spring)),
    onPress: handlePress,
  };

  const accessibilityLabel = `Intro from ${intro.matchmakerName}: ${intro.note}`;

  if (variant === "stack") {
    return (
      <Animated.View entering={FadeInDown.duration(220).delay(index * 60)}>
        <Pressable
          {...pressHandlers}
          accessible
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          <Animated.View
            style={[
              {
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[4],
                backgroundColor: surface.paper,
                borderRadius: radii.md,
                padding: spacing[4],
              },
              elevation.xs,
              animatedStyle,
            ]}
          >
            <View
              style={{
                borderRadius: radii.pill,
                borderWidth: 1.5,
                borderColor: plum[100],
                padding: 2,
              }}
            >
              <Avatar name={intro.matchAvatarName} size={36} imageUri={intro.matchAvatarUri} />
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontFamily: fonts.monoMedium,
                  fontSize: fontSize["2xs"][0],
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: coral[500],
                }}
              >
                Intro from {intro.matchmakerName}
              </Text>
              <TruncatedText
                numberOfLines={1}
                style={{
                  fontFamily: fonts.body,
                  fontSize: fontSize.sm[0],
                  lineHeight: fontSize.sm[1],
                  color: ink[900],
                }}
              >
                {intro.note}
              </TruncatedText>
            </View>
          </Animated.View>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(250).delay(index * 80)}>
      <Pressable
        {...pressHandlers}
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Animated.View style={animatedStyle}>
          <LinearGradient
            colors={gradients.sunset}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              {
                borderRadius: radii.xl,
                padding: spacing[6],
                overflow: "hidden",
              },
              elevation.sm,
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[4] }}>
              <View
                style={{
                  borderRadius: radii.pill,
                  borderWidth: 2,
                  borderColor: plum[300],
                  padding: 2,
                }}
              >
                <Avatar name={intro.matchAvatarName} size={40} imageUri={intro.matchAvatarUri} />
              </View>

              <Text
                style={{
                  flexShrink: 1,
                  fontFamily: fonts.monoMedium,
                  fontSize: fontSize.xs[0],
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: "#FFFFFF",
                }}
              >
                Intro from {intro.matchmakerName}
              </Text>
            </View>

            <Text
              style={{
                marginTop: spacing[4],
                fontFamily: fonts.display,
                fontSize: fontSize.xl[0],
                lineHeight: fontSize.xl[1],
                color: "#FFFFFF",
              }}
            >
              {intro.note}
            </Text>
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export default IntroPreviewCard;
```

Notes for the implementer:
- The hero note has **no** `numberOfLines`/`TruncatedText` — it wraps to full length per the design review ("show the note, don't tease it"). Only the compact `stack` variant truncates (1 line, word-safe via the existing `TruncatedText`), since it's a secondary preview and tapping it opens the full intro.
- The plum ring (`borderColor: plum[300]` on hero, `plum[100]` on stack) is the load-bearing plum/trust cue requested in the review — do not drop it.
- Avatar moved inline with the eyebrow (row layout) instead of bottom-anchored — this is what removes the dead space and cuts card height.

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/intro/IntroPreviewCard.tsx
git commit -m "fix: restore sunset gradient, add hero/stack card variants, stop truncating the hero note"
```

---

### Task 3: IntroFeed — compose one hero card + a "Next up" stack

**Files:**
- Modify: `components/home/IntroFeed.tsx`

**Interfaces:**
- Consumes: `IntroPreviewCard` `variant` prop (Task 2).

- [ ] **Step 1: Replace the whole file**

Replace the full contents of `components/home/IntroFeed.tsx` with:

```tsx
import { Text, View } from "react-native";
import { EmptyIntrosState } from "./EmptyIntrosState";
import { IntroPreviewCard } from "../intro/IntroPreviewCard";
import type { IntroPreview } from "../intro/mockIntros";
import { coral, ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

interface IntroFeedProps {
  intros: IntroPreview[];
  onInvitePress?: () => void;
}

export function IntroFeed({ intros, onInvitePress }: IntroFeedProps) {
  const [hero, ...rest] = intros;
  const nextUp = rest.slice(0, 2);

  return (
    <View style={{ gap: spacing[4] }}>
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: fontSize.xs[0],
          letterSpacing: 1,
          textTransform: "uppercase",
          color: coral[500],
        }}
      >
        Your intros
      </Text>

      {!hero ? (
        <EmptyIntrosState onInvitePress={onInvitePress} />
      ) : (
        <View style={{ gap: spacing[4] }}>
          <IntroPreviewCard intro={hero} index={0} variant="hero" />

          {nextUp.length > 0 && (
            <View style={{ gap: spacing[2] }}>
              <Text
                style={{
                  fontFamily: fonts.monoMedium,
                  fontSize: fontSize["2xs"][0],
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: ink[500],
                }}
              >
                Next up
              </Text>
              {nextUp.map((intro, i) => (
                <IntroPreviewCard key={intro.id} intro={intro} index={i + 1} variant="stack" />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default IntroFeed;
```

This preserves the previous "show at most 3" behavior (1 hero + 2 stack).

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/home/IntroFeed.tsx
git commit -m "feat: differentiate hero intro card from a compact next-up stack"
```

---

### Task 4: TabBar — elevation tiers + FAB/nav-pill separation

**Files:**
- Modify: `components/home/TabBar.tsx`

**Interfaces:**
- Consumes: `elevation.lg`, `elevation.brand` (Task 1).

- [ ] **Step 1: Update the colors import (drop `shadowTint`, it's now sourced via `elevation`)**

Replace:

```ts
import { coral, gradients, ink, shadowTint, surface } from "../../constants/colors";
```

with:

```ts
import { coral, gradients, ink, surface } from "../../constants/colors";
import { elevation } from "../../constants/elevation";
```

- [ ] **Step 2: Increase FAB overhang so it clears the pill instead of overlapping it**

Replace:

```ts
// 44 (not 28) so the FAB's bottom edge clears the tab icon centered beneath
// it in the pill by ~13pt instead of nearly touching it.
const FAB_OVERHANG = 44;
```

with:

```ts
// FAB height (56) + a visible gap above the pill's top edge, so the FAB
// floats fully clear of the pill instead of overlapping ~12pt into it.
const FAB_OVERHANG = 56 + spacing[2];
```

- [ ] **Step 3: Move the pill's shadow onto the `lg` elevation tier**

Replace:

```tsx
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          height: 72,
          borderRadius: radii.pill,
          backgroundColor: surface.paper,
          paddingHorizontal: spacing[6],
          shadowColor: shadowTint,
          shadowOpacity: 1,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        }}
      >
```

with:

```tsx
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            height: 72,
            borderRadius: radii.pill,
            backgroundColor: surface.paper,
            paddingHorizontal: spacing[6],
          },
          elevation.lg,
        ]}
      >
```

- [ ] **Step 4: Move the FAB's shadow onto the `brand` elevation tier**

Replace:

```tsx
          <LinearGradient
            colors={gradients.ember}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 56,
              height: 56,
              borderRadius: radii.pill,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: coral[500],
              shadowOpacity: 0.4,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }}
          >
```

with:

```tsx
          <LinearGradient
            colors={gradients.ember}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              {
                width: 56,
                height: 56,
                borderRadius: radii.pill,
                alignItems: "center",
                justifyContent: "center",
              },
              elevation.brand,
            ]}
          >
```

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors. (`coral` stays used by `TabIcon`'s active-state color — confirm no unused-import lint error.)

- [ ] **Step 6: Commit**

```bash
git add components/home/TabBar.tsx
git commit -m "fix: separate FAB from nav pill with more clearance and its own elevation tier"
```

---

### Task 5: DevNav — fix the clipped DEV badge

**Files:**
- Modify: `components/dev/DevNav.tsx`

- [ ] **Step 1: Import `spacing`**

Replace:

```ts
import { radii } from "../../constants/spacing";
```

with:

```ts
import { radii, spacing } from "../../constants/spacing";
```

- [ ] **Step 2: Inset the collapsed tab from the true screen edge and top corner**

Replace:

```tsx
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          right: 0,
          top: insets.top + 8,
        }}
      >
```

with:

```tsx
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          right: insets.right + spacing[2],
          top: insets.top + spacing[4],
        }}
      >
```

This keeps it reading as a right-edge tab while pulling it in from the literal screen edge and away from the sharpest top-corner curvature, so it's no longer clipped.

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/dev/DevNav.tsx
git commit -m "fix: inset DEV badge from screen edge so it's no longer clipped"
```

---

### Task 6: FriendsRow — widen the scroll-affordance fade

**Files:**
- Modify: `components/home/FriendsRow.tsx`

- [ ] **Step 1: Widen the fade mask to fully cover the last avatar (64px wide) instead of 40px**

Replace:

```tsx
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: spacing[8],
          }}
```

with:

```tsx
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: spacing[10],
          }}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/home/FriendsRow.tsx
git commit -m "fix: widen FriendsRow fade mask to fully cover the last avatar"
```

---

### Task 7: HomeHeader — contextual subhead

**Files:**
- Modify: `components/home/HomeHeader.tsx`
- Modify: `app/(tabs)/index.tsx`

**Interfaces:**
- Produces: `HomeHeaderProps.subhead?: string`.

- [ ] **Step 1: Replace the whole HomeHeader.tsx file**

Replace the full contents of `components/home/HomeHeader.tsx` with:

```tsx
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Button } from "../ui/Button";
import { WingMark } from "../ui/WingMark";
import { coral, ink, plum } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";

interface HomeHeaderProps {
  name?: string;
  loading?: boolean;
  subhead?: string;
  onInvitePress?: () => void;
}

export function HomeHeader({ name, loading, subhead, onInvitePress }: HomeHeaderProps) {
  return (
    <Animated.View entering={FadeInDown.duration(250)} style={{ gap: spacing[2] }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, minWidth: 0 }}>
          <WingMark size={20} color={coral[500]} />
          {loading ? (
            <NameSkeleton />
          ) : (
            <Text
              style={{
                fontFamily: fonts.displaySemibold,
                fontSize: fontSize.xl[0],
                lineHeight: fontSize.xl[1],
                color: ink[900],
                flexShrink: 1,
              }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              Hey {name ?? "there"}
            </Text>
          )}
        </View>

        <Button
          title="Invite"
          variant="outline"
          onPress={onInvitePress}
          style={{ height: 44, paddingHorizontal: 16, borderColor: plum[100] }}
        />
      </View>

      {!loading && subhead && (
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.sm[0],
            lineHeight: fontSize.sm[1],
            color: ink[500],
          }}
        >
          {subhead}
        </Text>
      )}
    </Animated.View>
  );
}

// Pulses in place of "Hey {name}" while the profile query is in flight, so
// the screen never flashes the "there" fallback before the real name loads.
function NameSkeleton() {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width: 96,
          height: fontSize.xl[1],
          borderRadius: radii.sm,
          backgroundColor: ink[100],
        },
        animatedStyle,
      ]}
    />
  );
}

export default HomeHeader;
```

- [ ] **Step 2: Compute the subhead in `app/(tabs)/index.tsx` and pass it down**

Replace:

```tsx
import { ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeHeader } from "../../components/home/HomeHeader";
import { IntroFeed } from "../../components/home/IntroFeed";
import { FriendsRow } from "../../components/home/FriendsRow";
import { MOCK_INTROS } from "../../components/intro/mockIntros";
import { MOCK_FRIENDS } from "../../components/home/friendsMock";
import { TAB_BAR_CLEARANCE } from "../../components/home/TabBar";
import { useAuthStore } from "../../store/auth";
import { getUserProfile } from "../../lib/supabase";
import { surface } from "../../constants/colors";
import { spacing } from "../../constants/spacing";

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
        <HomeHeader name={name} loading={!!userId && isLoading} />
        <IntroFeed intros={MOCK_INTROS} />
        <FriendsRow friends={MOCK_FRIENDS} />
      </ScrollView>
    </View>
  );
}
```

with:

```tsx
import { ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeHeader } from "../../components/home/HomeHeader";
import { IntroFeed } from "../../components/home/IntroFeed";
import { FriendsRow } from "../../components/home/FriendsRow";
import { MOCK_INTROS } from "../../components/intro/mockIntros";
import { MOCK_FRIENDS } from "../../components/home/friendsMock";
import { TAB_BAR_CLEARANCE } from "../../components/home/TabBar";
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
        <IntroFeed intros={MOCK_INTROS} />
        <FriendsRow friends={MOCK_FRIENDS} />
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/home/HomeHeader.tsx "app/(tabs)/index.tsx"
git commit -m "feat: add contextual subhead to home header"
```

---

### Task 8: Design critique + code review pass

**Files:** none (verification only)

- [ ] **Step 1: Run the app and visually verify all 10 findings**

Use the `/run` skill to launch the app (simulator or device — not the web preview, per this repo's known RN-web gotchas around absolute positioning and safe-area insets) and confirm on the Home tab:
1. Intro-note (hero) card shows the coral→blush sunset gradient, not flat coral.
2. The hero card and any "next up" cards are visually distinct (gradient hero vs. compact white rows).
3. The hero card is noticeably shorter, with the avatar inline next to the eyebrow instead of bottom-anchored.
4. The hero note wraps in full with no ellipsis.
5. Plum is visible on both card variants (avatar ring).
6. Cards, the nav pill, and the FAB all show a visible warm-tinted shadow; card and button presses spring-scale with haptics.
7. The FAB visibly floats above the nav pill with a gap, not touching it.
8. The DEV badge is fully visible, not clipped at the screen edge.
9. The last avatar in "On Wing" fades or peeks — doesn't hard-cut.
10. "Hey {name}" has a one-line contextual subhead when there are pending intros.

- [ ] **Step 2: Run the Design Critique Checklist from `CLAUDE.md`**

Contrast, hierarchy, alignment, proximity, repetition, balance, white space, unity — confirm the Home screen holds up against all eight, and that nothing outside the 10 findings regressed (cream background, coral-only CTA discipline, mono eyebrows, friend-named copy).

- [ ] **Step 3: Run a code review of the diff**

Use the `/code-review` skill (medium or high effort) against the branch diff. Address any correctness findings before considering this done; use judgment on style/simplification suggestions.

- [ ] **Step 4: Full repo verification**

Run: `npm run typecheck && npm run lint`
Expected: no errors, repo-wide.
