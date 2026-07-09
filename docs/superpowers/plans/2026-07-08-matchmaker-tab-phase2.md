# Matchmaker Tab Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a branded share card, fix the unlabeled/unexplained streak indicator, turn the score into an action pointer (milestone copy + pending-intro banner), and clean up color/labeling/spacing issues on the Profile screen's Matchmaker tab.

**Architecture:** Two new presentational components (`MatchmakerShareCard`, `ShareScoreModal`) added under `components/profile/`, wired into the existing `MatchmakerPanel.tsx` via a new share-icon button. `RankProgressBar.tsx` gets new props for the streak at-risk state and a "Level Progress" label. Mock data in `mockProfile.ts` gains the new fields these need, following the file's existing flat-mock-constant convention. `TabBar.tsx` gets a one-constant fix for FAB clearance.

**Tech Stack:** Expo (React Native) SDK 54, TypeScript strict, React Native Reanimated 3, react-native-svg, expo-linear-gradient — all already in use. New: `react-native-view-shot` (capture the share card as a PNG), `expo-sharing` (native share sheet).

## Global Constraints

- Coral (`coral[500]`) is reserved for primary action / the score only — never use it for non-CTA badges or decoration (this phase actively fixes a violation of this rule).
- No read receipts, no "they passed" reveals, no matchmaker visibility into accept/pass decisions — the pending-intro banner may show *that* an intro was sent and to whom, since that's already visible on the Intros tab, but must never show or imply anything about the recipients' responses.
- All spacing from the 4px scale in `constants/spacing.ts` (`spacing[2]`=8, `spacing[4]`=16, `spacing[6]`=24, etc.) — no magic numbers.
- Three fonts, one job each: `fonts.display`/`fonts.displaySemibold` (Bricolage) for big/hero numbers, `fonts.body`/`fonts.bodyMedium` (DM Sans) for reading text, `fonts.mono`/`fonts.monoMedium` (DM Mono) for uppercase eyebrow labels and stat numerals.
- Gradients (`constants/colors.ts` → `gradients`) are reserved for hero moments only — the new share card is exactly this use case (`gradients.dusk`).
- Shadows use `shadowTint` (warm-tinted), never pure black.
- Keep files under 500 lines.
- No automated test runner exists in this repo (no jest, no `.test.` files anywhere) — verification is `npm run typecheck` + `npm run lint` after every task, plus a final manual pass in the running app.

---

### Task 1: Mock data additions (streak-at-risk, milestone copy, badge retone)

**Files:**
- Modify: `components/profile/mockProfile.ts`

**Interfaces:**
- Produces: `MatchmakerRankProgress.streakAtRisk: boolean`, `MatchmakerRankProgress.streakResetsInDays: number`, `MOCK_NEXT_MILESTONE_COPY: string` — consumed by Task 6 (`RankProgressBar`) and Task 7 (`MatchmakerPanel`).
- Produces: `MOCK_BADGES` retoned — consumed by the existing (unchanged) badge-rendering loop in `MatchmakerPanel.tsx`.

- [ ] **Step 1: Add the two new `MatchmakerRankProgress` fields and update the mock value**

In `components/profile/mockProfile.ts`, replace:

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

with:

```ts
export interface MatchmakerRankProgress {
  tier: "Wingperson" | "Setup Artist" | "Cupid" | "Matchmaker Legend";
  level: number;
  xpCurrent: number;
  xpForNextLevel: number;
  streakWeeks: number;
  streakAtRisk: boolean;
  streakResetsInDays: number;
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
  streakAtRisk: true,
  streakResetsInDays: 1,
};

// TODO: replace once real progression math exists server-side. Precomputed
// nudge copy, not derived from a formula — same convention as score/
// percentileLabel above.
export const MOCK_NEXT_MILESTONE_COPY = "2 more intros to reach 100";
```

- [ ] **Step 2: Retone `MOCK_BADGES`**

Replace:

```ts
export const MOCK_BADGES: MatchmakerBadge[] = [
  { id: "1", label: "Top Matchmaker", tone: "coral", variant: "solid" },
  { id: "2", label: "5 Intros Sent", tone: "plum", variant: "outline" },
  { id: "3", label: "3 Matches Made", tone: "mint", variant: "outline" },
];
```

with:

```ts
export const MOCK_BADGES: MatchmakerBadge[] = [
  { id: "1", label: "Top Matchmaker", tone: "butter", variant: "outline" },
  { id: "2", label: "5 Intros Sent", tone: "plum", variant: "outline" },
  { id: "3", label: "3 Matches Made", tone: "mint", variant: "outline" },
];
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors (this file has no consumers yet that read the new fields, so nothing can break here).

- [ ] **Step 4: Commit**

```bash
git add components/profile/mockProfile.ts
git commit -m "Add streak-at-risk/milestone-copy mock fields, retone matchmaker badges"
```

---

### Task 2: Add sharing dependencies

**Files:**
- Modify: `package.json`, `package-lock.json` (via install)

**Interfaces:**
- Produces: `react-native-view-shot` (default export `ViewShot`, ref method `.capture(): Promise<string>`), `expo-sharing` (named export `shareAsync(uri: string): Promise<void>`, `isAvailableAsync(): Promise<boolean>`) — consumed by Task 4 (`ShareScoreModal`).

- [ ] **Step 1: Install the packages via the Expo CLI (keeps versions aligned with the installed SDK)**

Run: `npx expo install react-native-view-shot expo-sharing`
Expected: both packages added to `package.json` `dependencies`, lockfile updated, no peer-dependency warnings.

- [ ] **Step 2: Verify the install**

Run: `cat package.json | grep -E "view-shot|expo-sharing"`
Expected: two lines showing both packages with version ranges.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors (nothing imports these packages yet).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add react-native-view-shot and expo-sharing dependencies"
```

---

### Task 3: `MatchmakerShareCard` component

**Files:**
- Create: `components/profile/MatchmakerShareCard.tsx`

**Interfaces:**
- Consumes: `MatchmakerBadge` type from `./mockProfile` (`{ id: string; label: string; tone: ...; variant?: ... }` — only `.label` is actually read).
- Produces: `MatchmakerShareCard` component, props `{ score: number; rankTier: string; rankLevel: number; percentileLabel: string; badges: MatchmakerBadge[] }` — consumed by Task 4 (`ShareScoreModal`).

- [ ] **Step 1: Write the component**

```tsx
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { gradients } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { WingMark } from "../ui/WingMark";
import type { MatchmakerBadge } from "./mockProfile";

export const SHARE_CARD_WIDTH = 270;
export const SHARE_CARD_HEIGHT = 480; // 9:16 — Instagram Story / iMessage ratio

interface MatchmakerShareCardProps {
  score: number;
  rankTier: string;
  rankLevel: number;
  percentileLabel: string;
  badges: MatchmakerBadge[];
}

export function MatchmakerShareCard({
  score,
  rankTier,
  rankLevel,
  percentileLabel,
  badges,
}: MatchmakerShareCardProps) {
  return (
    <LinearGradient
      colors={gradients.dusk}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: SHARE_CARD_WIDTH,
        height: SHARE_CARD_HEIGHT,
        borderRadius: radii.xl,
        padding: spacing[6],
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View style={{ alignItems: "center", gap: spacing[2] }}>
        <WingMark size={28} color="#FFFFFF" />
        <Text
          style={{
            fontFamily: fonts.monoMedium,
            fontSize: fontSize["2xs"][0],
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "#FFFFFF",
          }}
        >
          Matchmaker Score
        </Text>
      </View>

      <View style={{ alignItems: "center", gap: spacing[2] }}>
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 72,
            lineHeight: 76,
            color: "#FFFFFF",
          }}
        >
          {score}
        </Text>
        <Text
          style={{
            fontFamily: fonts.bodyMedium,
            fontSize: fontSize.base[0],
            color: "rgba(255,255,255,0.8)",
          }}
        >
          {`${rankTier} · Lvl ${rankLevel}`}
        </Text>
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.sm[0],
            lineHeight: fontSize.sm[1],
            color: "rgba(255,255,255,0.9)",
            textAlign: "center",
            marginTop: spacing[2],
          }}
        >
          {percentileLabel}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: spacing[2],
        }}
      >
        {badges.map((badge) => (
          <View
            key={badge.id}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: radii.pill,
              backgroundColor: "rgba(255,255,255,0.18)",
            }}
          >
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: fontSize["2xs"][0],
                letterSpacing: 0.5,
                textTransform: "uppercase",
                color: "#FFFFFF",
              }}
            >
              {badge.label}
            </Text>
          </View>
        ))}
      </View>

      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: fontSize["2xs"][0],
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        wing
      </Text>
    </LinearGradient>
  );
}

export default MatchmakerShareCard;
```

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors (component isn't rendered anywhere yet, but must still type-check standalone).

- [ ] **Step 3: Commit**

```bash
git add components/profile/MatchmakerShareCard.tsx
git commit -m "Add MatchmakerShareCard: branded gradient share card visual"
```

---

### Task 4: `ShareScoreModal` component

**Files:**
- Create: `components/profile/ShareScoreModal.tsx`

**Interfaces:**
- Consumes: `MatchmakerShareCard` (Task 3), `MatchmakerBadge` type from `./mockProfile`, `SHARE_CARD_WIDTH`/`SHARE_CARD_HEIGHT` from `./MatchmakerShareCard`.
- Produces: `ShareScoreModal` component, props `{ visible: boolean; onClose: () => void; score: number; rankTier: string; rankLevel: number; percentileLabel: string; badges: MatchmakerBadge[] }` — consumed by Task 5 (`MatchmakerPanel`).

- [ ] **Step 1: Write the component**

```tsx
import { useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import { Button } from "../ui/Button";
import { MatchmakerShareCard, SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from "./MatchmakerShareCard";
import { ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";
import type { MatchmakerBadge } from "./mockProfile";

function CloseIcon({ size = 22, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1={6} y1={6} x2={18} y2={18} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={18} y1={6} x2={6} y2={18} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

interface ShareScoreModalProps {
  visible: boolean;
  onClose: () => void;
  score: number;
  rankTier: string;
  rankLevel: number;
  percentileLabel: string;
  badges: MatchmakerBadge[];
}

export function ShareScoreModal({
  visible,
  onClose,
  score,
  rankTier,
  rankLevel,
  percentileLabel,
  badges,
}: ShareScoreModalProps) {
  const viewShotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (uri) {
        await Sharing.shareAsync(uri);
      }
    } catch (err) {
      console.error("Failed to share matchmaker score:", err);
    } finally {
      setSharing(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(26,20,18,0.85)",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing[6],
          padding: spacing[6],
        }}
      >
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          style={{ position: "absolute", top: spacing[10], right: spacing[6] }}
        >
          <CloseIcon />
        </Pressable>

        <ViewShot
          ref={viewShotRef}
          options={{ format: "png", quality: 1, result: "tmpfile", pixelRatio: 4 }}
        >
          <MatchmakerShareCard
            score={score}
            rankTier={rankTier}
            rankLevel={rankLevel}
            percentileLabel={percentileLabel}
            badges={badges}
          />
        </ViewShot>

        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.sm[0],
            color: ink[100],
            textAlign: "center",
          }}
        >
          {`Sized for Instagram Story & iMessage (${SHARE_CARD_WIDTH}×${SHARE_CARD_HEIGHT} preview, captured at 4x)`}
        </Text>

        <Button
          title={sharing ? "Preparing..." : "Share"}
          onPress={handleShare}
          loading={sharing}
          style={{ width: "100%" }}
        />
      </View>
    </Modal>
  );
}

export default ShareScoreModal;
```

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors. If `react-native-view-shot`'s bundled types don't expose a `.capture()` method on the ref type cleanly, use `(viewShotRef.current as any)?.capture?.()` at that one call site rather than widening the whole file's types — check the installed package's `index.d.ts` first (`node_modules/react-native-view-shot/index.d.ts`) before reaching for `any`.

- [ ] **Step 3: Commit**

```bash
git add components/profile/ShareScoreModal.tsx
git commit -m "Add ShareScoreModal: preview + native share sheet for the score card"
```

---

### Task 5: Wire share button + modal into `MatchmakerPanel`

**Files:**
- Modify: `components/profile/MatchmakerPanel.tsx`

**Interfaces:**
- Consumes: `ShareScoreModal` (Task 4).
- Produces: share entry point visible on the score card — no new props on `MatchmakerPanel` itself (uses its existing `score`, `percentileLabel`, `badges`, `rankProgress` props).

- [ ] **Step 1: Add imports and the share icon**

At the top of `components/profile/MatchmakerPanel.tsx`, change:

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

to:

```tsx
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { MatchmakerScoreRing } from "./MatchmakerScoreRing";
import { RankProgressBar } from "./RankProgressBar";
import { ShareScoreModal } from "./ShareScoreModal";
import { coral, ink, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import type { MatchmakerBadge, MatchmakerRankProgress } from "./mockProfile";

function ShareIcon({ size = 20, color = ink[500] }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v12" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path
        d="M7 8l5-5 5 5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
```

(`ink[500]` used as `ShareIcon`'s default color argument is fine here since `ink` is imported above in the same module before this function is defined at module-evaluation time — function bodies/default params are only evaluated when called, so ordering is not an issue.)

- [ ] **Step 2: Add the header row with the share button, and modal state, inside `MatchmakerPanel`**

Replace:

```tsx
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
  return (
    <View style={{ gap: spacing[6] }}>
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
```

with:

```tsx
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
  const [shareModalVisible, setShareModalVisible] = useState(false);

  function handleSharePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShareModalVisible(true);
  }

  return (
    <View style={{ gap: spacing[6] }}>
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
        <View style={{ position: "relative" }}>
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
          <Pressable
            onPress={handleSharePress}
            accessibilityRole="button"
            accessibilityLabel="Share your matchmaker score"
            hitSlop={8}
            style={{ position: "absolute", top: -4, right: 0 }}
          >
            <ShareIcon />
          </Pressable>
        </View>
```

- [ ] **Step 3: Render the modal as a sibling of the main content**

Replace the component's closing:

```tsx
      {badges.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
          {badges.map((badge) => (
            <Badge key={badge.id} label={badge.label} tone={badge.tone} variant={badge.variant} />
          ))}
        </View>
      )}
    </View>
  );
}
```

with:

```tsx
      {badges.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
          {badges.map((badge) => (
            <Badge key={badge.id} label={badge.label} tone={badge.tone} variant={badge.variant} />
          ))}
        </View>
      )}

      <ShareScoreModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        score={score}
        rankTier={rankProgress.tier}
        rankLevel={rankProgress.level}
        percentileLabel={percentileLabel}
        badges={badges}
      />
    </View>
  );
}
```

(The `Modal` inside `ShareScoreModal` renders through React Native's native modal portal, so it doesn't matter that it's nested inside the scrollable `View` here — no layout side effects.)

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/profile/MatchmakerPanel.tsx
git commit -m "Wire share button and ShareScoreModal into the Matchmaker score card"
```

---

### Task 6: `RankProgressBar` — Level Progress label, Streak label, at-risk state

**Files:**
- Modify: `components/profile/RankProgressBar.tsx`

**Interfaces:**
- Produces: `RankProgressBarProps` gains `streakAtRisk?: boolean` (default `false`), `streakResetsInDays?: number` (default `0`) — consumed by Task 7 (`MatchmakerPanel`'s call site, which will start passing the real values from `rankProgress`).

- [ ] **Step 1: Update `StreakFlame` to accept a color prop**

Replace:

```tsx
function StreakFlame({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={FLAME_PATH} fill={coral[500]} />
    </Svg>
  );
}
```

with:

```tsx
function StreakFlame({ size = 14, color = coral[500] }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={FLAME_PATH} fill={color} />
    </Svg>
  );
}
```

- [ ] **Step 2: Add the new props**

Replace:

```tsx
interface RankProgressBarProps {
  xpCurrent: number;
  xpForNextLevel: number;
  streakWeeks: number;
}

export function RankProgressBar({ xpCurrent, xpForNextLevel, streakWeeks }: RankProgressBarProps) {
```

with:

```tsx
interface RankProgressBarProps {
  xpCurrent: number;
  xpForNextLevel: number;
  streakWeeks: number;
  streakAtRisk?: boolean;
  streakResetsInDays?: number;
}

export function RankProgressBar({
  xpCurrent,
  xpForNextLevel,
  streakWeeks,
  streakAtRisk = false,
  streakResetsInDays = 0,
}: RankProgressBarProps) {
```

- [ ] **Step 3: Add the "Level Progress" label and rebuild the streak row**

Replace:

```tsx
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
```

with:

```tsx
  return (
    <View style={{ gap: spacing[2] }}>
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: fontSize.xs[0],
          letterSpacing: 1,
          textTransform: "uppercase",
          color: ink[500],
        }}
      >
        LEVEL PROGRESS
      </Text>

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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: streakAtRisk ? 8 : 0,
            paddingVertical: streakAtRisk ? 3 : 0,
            borderRadius: radii.pill,
            backgroundColor: streakAtRisk ? coral[100] : "transparent",
          }}
        >
          <StreakFlame color={streakAtRisk ? coral[600] : coral[500]} />
          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: fontSize.xs[0],
              color: streakAtRisk ? coral[600] : ink[900],
            }}
          >
            {streakWeeks}
          </Text>
          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: fontSize["2xs"][0],
              letterSpacing: 1,
              textTransform: "uppercase",
              color: streakAtRisk ? coral[600] : ink[500],
            }}
          >
            {streakAtRisk ? `STREAK · ENDS IN ${streakResetsInDays}D` : "STREAK"}
          </Text>
        </View>
      </View>
```

(This requires `coral` to include a `600` key — check `constants/colors.ts`: it already does, `coral[600]: '#ED4733'`. No new color values needed.)

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors. `MatchmakerPanel.tsx`'s existing call site (`<RankProgressBar xpCurrent=... xpForNextLevel=... streakWeeks=... />`, no `streakAtRisk`/`streakResetsInDays`) still compiles because both new props default.

- [ ] **Step 5: Commit**

```bash
git add components/profile/RankProgressBar.tsx
git commit -m "Add Level Progress label and streak-at-risk state to RankProgressBar"
```

---

### Task 7: Milestone microcopy + pending-intro banner (`MatchmakerPanel` + `profile.tsx`)

**Files:**
- Modify: `components/profile/MatchmakerPanel.tsx`
- Modify: `app/(tabs)/profile.tsx`

**Interfaces:**
- Consumes: `SentIntro` type + `MOCK_SENT_INTROS` from `components/intros/mockSentIntros`, `formatRelativeTime` from `lib/format`, `MOCK_NEXT_MILESTONE_COPY` from `mockProfile` (Task 1).
- Produces: `MatchmakerPanelProps` gains `nextMilestoneCopy: string`, `pendingIntro?: SentIntro`.

This task changes both files together (not split further) because `MatchmakerPanelProps` gaining a required `nextMilestoneCopy` field and `profile.tsx`'s call site both need to land in the same commit for `npm run typecheck` to pass — splitting them would leave one half of the codebase failing to compile.

- [ ] **Step 1: Add imports and the `PendingIntroBanner` subcomponent to `MatchmakerPanel.tsx`**

Change the top of the file from:

```tsx
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { MatchmakerScoreRing } from "./MatchmakerScoreRing";
import { RankProgressBar } from "./RankProgressBar";
import { ShareScoreModal } from "./ShareScoreModal";
import { coral, ink, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import type { MatchmakerBadge, MatchmakerRankProgress } from "./mockProfile";
```

to:

```tsx
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { MatchmakerScoreRing } from "./MatchmakerScoreRing";
import { RankProgressBar } from "./RankProgressBar";
import { ShareScoreModal } from "./ShareScoreModal";
import { coral, ink, plum, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { formatRelativeTime } from "../../lib/format";
import type { SentIntro } from "../intros/mockSentIntros";
import type { MatchmakerBadge, MatchmakerRankProgress } from "./mockProfile";
```

Then add this subcomponent right after the `ShareIcon` function (still before `StatTile`):

```tsx
function PendingIntroBanner({ intro }: { intro: SentIntro }) {
  return (
    <View
      style={{
        backgroundColor: plum[100],
        borderRadius: radii.lg,
        padding: spacing[4],
        gap: 2,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.bodyMedium,
          fontSize: fontSize.sm[0],
          lineHeight: fontSize.sm[1],
          color: plum[600],
        }}
      >
        {`Your intro for ${intro.personAName} & ${intro.personBName} is still awaiting a reply`}
      </Text>
      <Text style={{ fontFamily: fonts.body, fontSize: fontSize.xs[0], color: ink[500] }}>
        {`Sent ${formatRelativeTime(intro.sentAt)}`}
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Add the new props to `MatchmakerPanelProps`**

Replace:

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
  nextMilestoneCopy: string;
  pendingIntro?: SentIntro;
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
  nextMilestoneCopy,
  pendingIntro,
  onMakeIntroPress,
}: MatchmakerPanelProps) {
```

- [ ] **Step 3: Render the banner above the score card, and pass streak props + milestone copy through**

Replace:

```tsx
  return (
    <View style={{ gap: spacing[6] }}>
      <View
        style={{
          backgroundColor: surface.paper,
```

with:

```tsx
  return (
    <View style={{ gap: spacing[6] }}>
      {pendingIntro && <PendingIntroBanner intro={pendingIntro} />}

      <View
        style={{
          backgroundColor: surface.paper,
```

Then replace:

```tsx
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
```

with:

```tsx
        <MatchmakerScoreRing
          score={score}
          rankTier={rankProgress.tier}
          rankLevel={rankProgress.level}
        />

        <Text
          style={{
            fontFamily: fonts.bodyMedium,
            fontSize: fontSize.sm[0],
            lineHeight: fontSize.sm[1],
            color: coral[600],
            textAlign: "center",
          }}
        >
          {nextMilestoneCopy}
        </Text>

        <RankProgressBar
          xpCurrent={rankProgress.xpCurrent}
          xpForNextLevel={rankProgress.xpForNextLevel}
          streakWeeks={rankProgress.streakWeeks}
          streakAtRisk={rankProgress.streakAtRisk}
          streakResetsInDays={rankProgress.streakResetsInDays}
        />
```

- [ ] **Step 4: Wire `profile.tsx` to compute and pass the new props**

In `app/(tabs)/profile.tsx`, change the import block:

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
import type { PrivacySettings, ProfilePrompt } from "../../components/profile/mockProfile";
```

to:

```tsx
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
import type { PrivacySettings, ProfilePrompt } from "../../components/profile/mockProfile";
import { MOCK_SENT_INTROS } from "../../components/intros/mockSentIntros";
```

Then, right before the `return (` statement in `ProfileScreen`, add:

```tsx
  const pendingIntro = MOCK_SENT_INTROS.find((intro) => intro.status === "pending");
```

Then change the `MatchmakerPanel` call:

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

to:

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
              nextMilestoneCopy={MOCK_NEXT_MILESTONE_COPY}
              pendingIntro={pendingIntro}
              onMakeIntroPress={() => comingSoon("Matchmaker")}
            />
          )}
```

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/profile/MatchmakerPanel.tsx "app/(tabs)/profile.tsx"
git commit -m "Add milestone microcopy and pending-intro banner to the Matchmaker tab"
```

---

### Task 8: FAB clearance fix

**Files:**
- Modify: `components/home/TabBar.tsx`

**Interfaces:** None — single constant change, no signature changes.

- [ ] **Step 1: Bump `FAB_OVERHANG`**

Replace:

```ts
const TAB_BAR_HEIGHT = 72;
const FAB_OVERHANG = 28;
const TAB_BAR_BOTTOM_GAP = spacing[2];
```

with:

```ts
const TAB_BAR_HEIGHT = 72;
// 44 (not 28) so the FAB's bottom edge clears the tab icon centered beneath
// it in the pill by ~13pt instead of nearly touching it.
const FAB_OVERHANG = 44;
const TAB_BAR_BOTTOM_GAP = spacing[2];
```

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors. `TAB_BAR_CLEARANCE` (derived from `FAB_OVERHANG`) is exported and consumed by every tab screen's `ScrollView` bottom padding — since it's still just a number, nothing else needs to change.

- [ ] **Step 3: Commit**

```bash
git add components/home/TabBar.tsx
git commit -m "Increase FAB overhang so it clears the tab bar icon beneath it"
```

---

### Task 9: Update `CLAUDE.md` per the project's self-maintenance rule

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** None — documentation only.

- [ ] **Step 1: Add the missing `/profile` row to the File Structure table**

The `/components` section of the File Structure table in `CLAUDE.md` currently lists `/ui`, `/intro`, `/intros`, `/chats`, `/chat`, `/auth`, `/dev` but has no `/profile` row at all, despite that directory existing since phase 1. Find this block:

```
  /chat                — MessageBubble, ChatInput, mockMessages (chat thread screen use)
  /auth                — PlaneTrailSuccess (OTP-verified success animation)
```

and insert a new line between them:

```
  /chat                — MessageBubble, ChatInput, mockMessages (chat thread screen use)
  /profile             — MatchmakerPanel, MatchmakerScoreRing, RankProgressBar, MatchmakerShareCard, ShareScoreModal (share-card capture + native share sheet), ProfileHeader, ProfileSegmentedControl, PhotoPromptPanel, PromptEditorModal, PrivacyPanel, mockProfile (score/rank/badge/pending-intro mock data)
  /auth                — PlaneTrailSuccess (OTP-verified success animation)
```

- [ ] **Step 2: Note the new dependencies in the Tech Stack block**

Find:

```
Animation:  React Native Reanimated 3 + Gesture Handler
```

and change it to:

```
Animation:  React Native Reanimated 3 + Gesture Handler
Sharing:    react-native-view-shot (view→PNG capture) + expo-sharing (native share sheet) — Matchmaker score share card
```

- [ ] **Step 3: Verify line count is still under the 500-line cap**

Run: `wc -l CLAUDE.md`
Expected: a number below 500.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "Document Matchmaker phase 2 files and new sharing dependencies in CLAUDE.md"
```

---

### Task 10: Full manual verification pass

**Files:** None modified — verification only.

- [ ] **Step 1: Confirm a dev client build is available**

`react-native-view-shot` requires a native rebuild — plain `npx expo start` connected to Expo Go will not load the Matchmaker tab correctly once this dependency is linked. Run: `npx expo run:ios` (or the project's existing dev-client build command, if one is already documented/running) rather than plain `expo start` + Expo Go.

- [ ] **Step 2: Walk the Matchmaker tab**

With the app running, go to Profile → Matchmaker segment and confirm, against the cream (`surface.cream`) background:

- The pending-intro banner (plum-100 card) appears above the score card, reading "Your intro for Diego Alvarez & Chloe Bennett is still awaiting a reply · Sent {relative date}" — this is the current mock's oldest `"pending"` entry in `MOCK_SENT_INTROS`.
- The score ring, count-up, and tap-to-flip still work exactly as before (unchanged from phase 1).
- Directly under the ring, the milestone microcopy "2 more intros to reach 100" renders in coral.
- The XP bar now shows a "LEVEL PROGRESS" label above the existing "340 / 500 XP TO NEXT LEVEL" line.
- The streak group shows "STREAK · ENDS IN 1D" in a coral-100 pill (since `MOCK_RANK_PROGRESS.streakAtRisk` is `true`) — temporarily flip it to `false` in `mockProfile.ts` and reload to confirm the neutral "STREAK" state (no pill, ink-colored) also renders correctly, then flip it back.
- The three badge pills (Top Matchmaker / 5 Intros Sent / 3 Matches Made) are all outline style now, in butter / plum / mint respectively — none solid, none coral.

- [ ] **Step 3: Walk the share flow**

- Tap the share icon (top-right of "Matchmaker Score"). Confirm a light haptic fires and the full-screen modal opens over a dark scrim.
- Confirm the preview card renders the coral→plum gradient, Wing mark, score, tier/level, percentile line, and all three badge chips legibly in white.
- Tap "Share" — confirm the button shows "Preparing..." briefly, then the native share sheet opens with a real image attached (not a blank/broken thumbnail).
- Actually send it to yourself via Messages (or another available share target) and confirm the received image is a legible, correctly-cropped 9:16 card.
- Close the modal via the X and confirm it dismisses cleanly with no error in the Metro/dev-client logs.

- [ ] **Step 4: Walk the FAB fix**

- On any tab screen, visually confirm the floating "+" button no longer touches or overlaps the tab icon in the slot beneath it.
- Scroll each of the four tab screens (For You, Intros, Chats, You) to the bottom and confirm no content is clipped behind the tab bar/FAB — `TAB_BAR_CLEARANCE`'s automatic recalculation should mean nothing else needs adjusting, but confirm visually since this touches shared layout.

- [ ] **Step 5: Final full-repo check**

Run: `npm run typecheck && npm run lint`
Expected: both pass cleanly with zero errors across the whole repo (not just the files touched in this plan).
