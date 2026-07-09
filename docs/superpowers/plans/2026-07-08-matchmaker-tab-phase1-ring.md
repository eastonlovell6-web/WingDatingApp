# Matchmaker Score Ring (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat Matchmaker Score card on the Profile screen's Matchmaker tab with an animated circular ring gauge (coral→plum gradient, count-up number, tap-to-flip rank title) plus an XP progress bar and streak flame.

**Architecture:** Two new self-contained components — `MatchmakerScoreRing` (SVG ring + count-up + flip) and `RankProgressBar` (XP bar + streak) — added to `components/profile/`, wired into the existing `MatchmakerPanel.tsx` in place of its current score card block. New mock data (`MatchmakerRankProgress`) added to `mockProfile.ts` following the existing flat-mock-constant convention.

**Tech Stack:** React Native + Expo, TypeScript strict mode, `react-native-svg` (ring), `react-native-reanimated` (all animation), `expo-haptics` (tap feedback). No new dependencies.

## Global Constraints

- Design system tokens only — colors from `constants/colors.ts` (`coral`, `plum`, `ink`, `surface`), spacing from `constants/spacing.ts`, fonts from `constants/typography.ts`. No new hex values, no new hues outside coral/plum/cream/ink.
- Ring gradient uses `gradients.dusk` stop colors (`coral[500]` → `plum[500]`) already defined in `constants/colors.ts`.
- No new npm dependencies — build entirely on `react-native-svg` and `react-native-reanimated`, both already installed.
- This repo has **no automated test runner** (no jest, no `.test.` files anywhere in the tree — verified by search). Per-task verification is `npm run typecheck` (must pass with zero errors) and `npm run lint`. The final task adds full manual runtime verification in the running Expo app, matching how the most recent animated feature in this codebase (`PlaneTrailSuccess`) was verified.
- Verify on iOS or Android (simulator/device), not the web preview — this project's memory notes that RN-Web has had layout/behavior gaps for animation-adjacent components in the past, so web-only verification isn't trustworthy here.
- Mock data only in this phase — no Supabase schema changes. `MatchmakerRankProgress` fields (`tier`, `level`, `xpCurrent`, `xpForNextLevel`, `streakWeeks`) are independent flat mock values, not derived from `score` by formula.
- Tapping the ring is disabled until the initial fill/count-up animation finishes (~1100ms after mount) — never allow a tap to interrupt the entrance animation.
- All Reanimated shared-value animations must be cancelled (`cancelAnimation`) on unmount.

---

### Task 1: Mock rank progress data

**Files:**
- Modify: `components/profile/mockProfile.ts:62-68` (insert after the `MOCK_MATCHMAKER_STATS` block, before `MOCK_HAS_SENT_INTROS`)

**Interfaces:**
- Produces: `export interface MatchmakerRankProgress { tier: "Wingperson" | "Setup Artist" | "Cupid" | "Matchmaker Legend"; level: number; xpCurrent: number; xpForNextLevel: number; streakWeeks: number; }` and `export const MOCK_RANK_PROGRESS: MatchmakerRankProgress`. Both consumed by Task 4.

- [ ] **Step 1: Add the interface and mock constant**

Insert this block immediately after the existing `MOCK_MATCHMAKER_STATS` export (after line 68, before the `MOCK_HAS_SENT_INTROS` comment/export):

```ts
export interface MatchmakerRankProgress {
  tier: "Wingperson" | "Setup Artist" | "Cupid" | "Matchmaker Legend";
  level: number;
  xpCurrent: number;
  xpForNextLevel: number;
  streakWeeks: number;
}

// TODO: replace with a real progression table once server-side rank/XP/streak
// tracking exists. tier/level/xp/streak are independent mock fields for now —
// not derived from `score` by any formula.
export const MOCK_RANK_PROGRESS: MatchmakerRankProgress = {
  tier: "Cupid",
  level: 4,
  xpCurrent: 340,
  xpForNextLevel: 500,
  streakWeeks: 3,
};
```

- [ ] **Step 2: Verify types compile**

Run: `npm run typecheck`
Expected: no errors (this is a pure additive change — nothing consumes the new export yet).

- [ ] **Step 3: Commit**

```bash
git add components/profile/mockProfile.ts
git commit -m "Add mock rank progress data for Matchmaker score ring"
```

---

### Task 2: `MatchmakerScoreRing` component

**Files:**
- Create: `components/profile/MatchmakerScoreRing.tsx`

**Interfaces:**
- Consumes: nothing from other new files (only design-system constants: `coral`, `plum`, `ink` from `constants/colors.ts`; `fonts`, `fontSize` from `constants/typography.ts`).
- Produces: `export function MatchmakerScoreRing(props: { score: number; rankTier: string; rankLevel: number }): JSX.Element`, consumed by Task 4.

- [ ] **Step 1: Create the component**

```tsx
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { coral, ink, plum } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";

const RING_SIZE = 160;
const STROKE_WIDTH = 14;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const FILL_DURATION = 1100;
const FLIP_DURATION = 450;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface MatchmakerScoreRingProps {
  score: number;
  rankTier: string;
  rankLevel: number;
}

export function MatchmakerScoreRing({ score, rankTier, rankLevel }: MatchmakerScoreRingProps) {
  const progress = useSharedValue(0);
  const flip = useSharedValue(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: FILL_DURATION, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setReady)(true);
      }
    );
    return () => {
      cancelAnimation(progress);
      cancelAnimation(flip);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  const countAnimatedProps = useAnimatedProps(() => ({
    text: `${Math.round(progress.value * score)}`,
  }));

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { rotateY: `${flip.value}deg` }],
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { rotateY: `${flip.value + 180}deg` }],
  }));

  function handleFlip() {
    if (!ready) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flip.value = withTiming(flip.value === 0 ? 180 : 0, {
      duration: FLIP_DURATION,
      easing: Easing.inOut(Easing.quad),
    });
  }

  return (
    <Pressable
      onPress={handleFlip}
      accessibilityRole="button"
      accessibilityLabel="Matchmaker score, tap to see rank"
      style={{ alignSelf: "center" }}
    >
      <View style={{ width: RING_SIZE, height: RING_SIZE }}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Defs>
            <LinearGradient id="scoreRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={coral[500]} />
              <Stop offset="100%" stopColor={plum[500]} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={ink[200]}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          <AnimatedCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke="url(#scoreRingGradient)"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            animatedProps={ringAnimatedProps}
            rotation={-90}
            originX={RING_SIZE / 2}
            originY={RING_SIZE / 2}
          />
        </Svg>

        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Animated.View
            style={[{ position: "absolute", backfaceVisibility: "hidden" }, frontStyle]}
          >
            <AnimatedTextInput
              editable={false}
              caretHidden
              pointerEvents="none"
              underlineColorAndroid="transparent"
              defaultValue="0"
              animatedProps={countAnimatedProps}
              style={{
                fontFamily: fonts.display,
                fontSize: fontSize["5xl"][0],
                lineHeight: fontSize["5xl"][1],
                color: coral[500],
                padding: 0,
                textAlign: "center",
              }}
            />
          </Animated.View>

          <Animated.View
            style={[
              {
                position: "absolute",
                backfaceVisibility: "hidden",
                alignItems: "center",
                width: RING_SIZE - STROKE_WIDTH * 2,
              },
              backStyle,
            ]}
          >
            <Text
              numberOfLines={2}
              style={{
                fontFamily: fonts.displaySemibold,
                fontSize: fontSize.lg[0],
                lineHeight: fontSize.lg[1],
                color: coral[500],
                textAlign: "center",
              }}
            >
              {rankTier}
            </Text>
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: fontSize.xs[0],
                letterSpacing: 1,
                textTransform: "uppercase",
                color: ink[500],
                marginTop: 2,
              }}
            >
              {`Lvl ${rankLevel}`}
            </Text>
          </Animated.View>
        </View>
      </View>
    </Pressable>
  );
}

export default MatchmakerScoreRing;
```

- [ ] **Step 2: Verify types compile**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: no errors on the new file (the `eslint-disable-next-line react-hooks/exhaustive-deps` comment is intentional — the mount effect must run exactly once).

- [ ] **Step 4: Commit**

```bash
git add components/profile/MatchmakerScoreRing.tsx
git commit -m "Add MatchmakerScoreRing: gauge ring, count-up, tap-to-flip rank"
```

---

### Task 3: `RankProgressBar` component

**Files:**
- Create: `components/profile/RankProgressBar.tsx`

**Interfaces:**
- Consumes: design-system constants only (`coral`, `ink`, `surface` from `constants/colors.ts`; `fonts`, `fontSize` from `constants/typography.ts`; `radii`, `spacing` from `constants/spacing.ts`).
- Produces: `export function RankProgressBar(props: { xpCurrent: number; xpForNextLevel: number; streakWeeks: number }): JSX.Element`, consumed by Task 4.

- [ ] **Step 1: Create the component**

```tsx
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { coral, ink, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";

const BAR_HEIGHT = 6;
// Starts right after MatchmakerScoreRing's ~1100ms fill animation settles,
// so the two gauges don't visually compete for attention.
const FILL_DELAY = 1100;
const FILL_DURATION = 700;

const FLAME_PATH =
  "M12 2C12 2 6 9 6 14C6 17.31 8.69 20 12 20C15.31 20 18 17.31 18 14C18 9 12 2 12 2Z";

function StreakFlame({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={FLAME_PATH} fill={coral[500]} />
    </Svg>
  );
}

interface RankProgressBarProps {
  xpCurrent: number;
  xpForNextLevel: number;
  streakWeeks: number;
}

export function RankProgressBar({ xpCurrent, xpForNextLevel, streakWeeks }: RankProgressBarProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const fillWidth = useSharedValue(0);
  const fraction = xpForNextLevel > 0 ? Math.min(xpCurrent / xpForNextLevel, 1) : 0;

  useEffect(() => {
    if (trackWidth === 0) return;
    fillWidth.value = withDelay(
      FILL_DELAY,
      withTiming(trackWidth * fraction, { duration: FILL_DURATION, easing: Easing.out(Easing.quad) })
    );
    return () => cancelAnimation(fillWidth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackWidth, fraction]);

  const fillStyle = useAnimatedStyle(() => ({ width: fillWidth.value }));

  return (
    <View style={{ gap: spacing[2] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text
          style={{
            fontFamily: fonts.monoMedium,
            fontSize: fontSize.xs[0],
            letterSpacing: 1,
            textTransform: "uppercase",
            color: ink[500],
          }}
        >
          {`${xpCurrent} / ${xpForNextLevel} XP TO NEXT LEVEL`}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <StreakFlame />
          <Text style={{ fontFamily: fonts.monoMedium, fontSize: fontSize.xs[0], color: ink[900] }}>
            {streakWeeks}
          </Text>
        </View>
      </View>

      <View
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        style={{
          height: BAR_HEIGHT,
          borderRadius: radii.pill,
          backgroundColor: surface.creamDeep,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={[{ height: BAR_HEIGHT, borderRadius: radii.pill, backgroundColor: coral[500] }, fillStyle]}
        />
      </View>
    </View>
  );
}

export default RankProgressBar;
```

- [ ] **Step 2: Verify types compile**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: no errors on the new file.

- [ ] **Step 4: Commit**

```bash
git add components/profile/RankProgressBar.tsx
git commit -m "Add RankProgressBar: XP progress bar and streak flame"
```

---

### Task 4: Wire into `MatchmakerPanel` and `profile.tsx`, verify end-to-end

**Files:**
- Modify: `components/profile/MatchmakerPanel.tsx:1-9` (imports), `:102-169` (props interface + score card block)
- Modify: `app/(tabs)/profile.tsx:23,30-40,219-229` (import + prop pass-through)

**Interfaces:**
- Consumes: `MatchmakerScoreRing` from Task 2, `RankProgressBar` from Task 3, `MatchmakerRankProgress`/`MOCK_RANK_PROGRESS` from Task 1.
- Produces: `MatchmakerPanelProps` gains a required `rankProgress: MatchmakerRankProgress` field — this is a breaking prop-interface change, so every caller of `<MatchmakerPanel />` must be updated in this same task (there is exactly one caller: `app/(tabs)/profile.tsx`).

- [ ] **Step 1: Update `MatchmakerPanel.tsx` imports**

In `components/profile/MatchmakerPanel.tsx`, replace the import block (current lines 1-8):

```tsx
import { Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { coral, ink, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import type { MatchmakerBadge } from "./mockProfile";
```

with:

```tsx
import { Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { MatchmakerScoreRing } from "./MatchmakerScoreRing";
import { RankProgressBar } from "./RankProgressBar";
import { coral, ink, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import type { MatchmakerBadge, MatchmakerRankProgress } from "./mockProfile";
```

- [ ] **Step 2: Update `MatchmakerPanelProps` and the component signature**

Replace the current interface and function signature (current lines 102-120):

```tsx
interface MatchmakerPanelProps {
  score: number;
  percentileLabel: string;
  introsSent: number;
  introsAccepted: number;
  hasSentIntros: boolean;
  badges: MatchmakerBadge[];
  onMakeIntroPress?: () => void;
}

export function MatchmakerPanel({
  score,
  percentileLabel,
  introsSent,
  introsAccepted,
  hasSentIntros,
  badges,
  onMakeIntroPress,
}: MatchmakerPanelProps) {
```

with:

```tsx
interface MatchmakerPanelProps {
  score: number;
  percentileLabel: string;
  introsSent: number;
  introsAccepted: number;
  hasSentIntros: boolean;
  badges: MatchmakerBadge[];
  rankProgress: MatchmakerRankProgress;
  onMakeIntroPress?: () => void;
}

export function MatchmakerPanel({
  score,
  percentileLabel,
  introsSent,
  introsAccepted,
  hasSentIntros,
  badges,
  rankProgress,
  onMakeIntroPress,
}: MatchmakerPanelProps) {
```

- [ ] **Step 3: Replace the score card block**

Replace the current score card `View` (current lines 123-169 — the `View` with `backgroundColor: surface.paper` down through its closing `</View>`, immediately before the `{hasSentIntros ? (` line) with:

```tsx
      <View
        style={{
          backgroundColor: surface.paper,
          borderRadius: radii.xl,
          padding: spacing[6],
          gap: spacing[4],
          alignItems: "stretch",
          shadowColor: shadowTint,
          shadowOpacity: 1,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        }}
      >
        <Text
          style={{
            fontFamily: fonts.monoMedium,
            fontSize: fontSize.xs[0],
            letterSpacing: 1,
            textTransform: "uppercase",
            color: coral[500],
            textAlign: "center",
          }}
        >
          Matchmaker Score
        </Text>

        <MatchmakerScoreRing
          score={score}
          rankTier={rankProgress.tier}
          rankLevel={rankProgress.level}
        />

        <RankProgressBar
          xpCurrent={rankProgress.xpCurrent}
          xpForNextLevel={rankProgress.xpForNextLevel}
          streakWeeks={rankProgress.streakWeeks}
        />

        {/* TODO(phase 2): replace with bell-curve distribution graphic */}
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.sm[0],
            lineHeight: fontSize.sm[1],
            color: ink[500],
            textAlign: "center",
          }}
        >
          {percentileLabel}
        </Text>
      </View>
```

(The rest of the file — the `{hasSentIntros ? (...) : (...)}` stat tiles block and the badges block — is unchanged.)

- [ ] **Step 4: Update `app/(tabs)/profile.tsx` to pass the new prop**

In the mock-data import block (current lines 30-40), add `MOCK_RANK_PROGRESS` and the type:

```tsx
import {
  MOCK_BADGES,
  MOCK_BLOCKED_COUNT,
  MOCK_HAS_SENT_INTROS,
  MOCK_INTRODUCERS_COUNT,
  MOCK_MATCHMAKER_STATS,
  MOCK_PHOTOS,
  MOCK_PRIVACY_SETTINGS,
  MOCK_PROFILE_USER,
  MOCK_PROMPTS,
  MOCK_RANK_PROGRESS,
} from "../../components/profile/mockProfile";
```

Then update the `<MatchmakerPanel />` call (current lines 219-229) to pass `rankProgress`:

```tsx
          {activeIndex === 1 && (
            <MatchmakerPanel
              score={MOCK_MATCHMAKER_STATS.score}
              percentileLabel={MOCK_MATCHMAKER_STATS.percentileLabel}
              introsSent={MOCK_MATCHMAKER_STATS.introsSent}
              introsAccepted={MOCK_MATCHMAKER_STATS.introsAccepted}
              hasSentIntros={MOCK_HAS_SENT_INTROS}
              badges={MOCK_BADGES}
              rankProgress={MOCK_RANK_PROGRESS}
              onMakeIntroPress={() => comingSoon("Matchmaker")}
            />
          )}
```

- [ ] **Step 5: Verify types compile**

Run: `npm run typecheck`
Expected: no errors. This is the step that would catch a missed caller of `MatchmakerPanel` (there is only the one, updated above) — a TS error here means another call site was missed.

- [ ] **Step 6: Verify lint passes**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Manual runtime verification**

Run: `npm run ios` (or `npm run android` — do not rely on `npm run web` for this verification per the Global Constraints above).

With the app running, navigate to the Profile tab, then tap the "Matchmaker" segment. Confirm all of the following:
1. The ring fills clockwise from 12 o'clock with a visible coral→plum gradient stroke, finishing at 82% of the circle (matching `MOCK_MATCHMAKER_STATS.score = 82`).
2. The number in the ring counts up from 0 and lands exactly on `82` when the ring finishes filling (~1.1s).
3. Tapping the ring before the count-up finishes does nothing (no flip).
4. Tapping the ring after the count-up finishes flips it to show "Cupid" / "Lvl 4"; tapping again flips back to "82". Each flip fires a light haptic (on a physical device — the simulator won't produce haptic feedback but should still animate).
5. Below the ring, the XP bar fills to `340 / 500` (68%) shortly after the ring settles, with the caption "340 / 500 XP TO NEXT LEVEL" and a coral flame + "3" to its right.
6. The "You're in the top 15%..." percentile caption still appears below the XP bar.
7. Switching to a different Profile tab segment and back to "Matchmaker" replays the entire sequence (ring fill, count-up, XP bar fill) from the start.
8. Visual check against the cream (`#FBF8F5`) background: the card's white surface, shadow, and all text remain legible and match the existing card style used elsewhere on this screen (e.g. the stat tiles below).

If any of these fail, fix the implementation before proceeding — do not commit a failing manual verification.

- [ ] **Step 8: Commit**

```bash
git add components/profile/MatchmakerPanel.tsx "app/(tabs)/profile.tsx"
git commit -m "Wire MatchmakerScoreRing and RankProgressBar into the Matchmaker tab"
```
