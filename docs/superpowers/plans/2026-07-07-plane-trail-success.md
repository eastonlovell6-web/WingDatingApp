# Plane Trail Success Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current orbit-loop success animation in `app/(auth)/verify.tsx` with a new component that recreates a reference loading animation's style (character + growing color trail) reskinned to Wing's brand — a WingMark plane flying down the screen leaving a Sunset-gradient contrail, then an idle bob loop, then a fade + "You're in." before navigating to `/(auth)/intent`.

**Architecture:** A new self-contained component, `components/auth/PlaneTrailSuccess.tsx`, owns all animation logic (shared values, three-phase sequence, idle bob, haptics, calling `onFinished`). `app/(auth)/verify.tsx` keeps its existing job (OTP UI, measuring the header WingMark's screen position, triggering on verify success) and renders the new component instead of its old inline animation block.

**Tech Stack:** React Native, Expo Router, `react-native-reanimated` (shared values, `useAnimatedStyle`, `useAnimatedReaction`, `withSequence`/`withTiming`/`withRepeat`), `react-native-worklets` (`scheduleOnRN`), `expo-linear-gradient`, `expo-haptics`, TypeScript strict mode.

## Global Constraints

- Keep files under 500 lines (CLAUDE.md).
- Do what has been asked; nothing more, nothing less — no scope beyond the approved spec (`docs/superpowers/specs/2026-07-07-plane-trail-success-design.md`).
- Default to no comments; only add one where the WHY is non-obvious (e.g. the existing codebase convention of documenting the `scheduleOnRN`-must-be-a-component-scope-function gotcha).
- Gradients restricted to the brand token pairs in `constants/colors.ts` (`coral`, `blush`, `plum`, `butter`) — no arbitrary hues.
- No automated test framework exists in this repo (confirmed: no `.test.` files under `app/`, no jest/testing-library in `package.json`). Verification is `npm run typecheck` (i.e. `tsc --noEmit`) plus manual run-through in the app — there is no unit test step in this plan.
- After this implementation, update `CLAUDE.md`'s File Structure table per its own Self-Maintenance Rule.

---

## File Structure

- **Create:** `components/auth/PlaneTrailSuccess.tsx` — the whole animation (trail, plane, idle bob, "You're in." text, haptics, `onFinished` callback). New `/components/auth` folder since this is the first auth-flow-specific animated component.
- **Modify:** `app/(auth)/verify.tsx` — remove the orbit-loop implementation (`ORBIT_*` constants, `orbitPt`/`TAIL_D`/`TAIL_HOT_D`, `successProgress`/`planeScale` shared values, `triggerSuccessAnimation`'s old body, `finishSuccess`, `contentFadeStyle`/`headerMarkHideStyle`/`flyerStyle`/`orbitStyle`/`tintStyle`, and the whole `showSuccess && (...)` render block), replace with a simpler trigger (`triggerSuccessAnimation` just measures the header + fades the form + flips `showSuccess`) and render `<PlaneTrailSuccess />`.
- **Modify:** `CLAUDE.md` — add `components/auth/PlaneTrailSuccess.tsx` to the File Structure table (Task 3).

---

### Task 1: Create `PlaneTrailSuccess` component

**Files:**
- Create: `components/auth/PlaneTrailSuccess.tsx`

**Interfaces:**
- Produces: `PlaneTrailSuccess({ visible, originX, originY, onFinished }: { visible: boolean; originX: number; originY: number; onFinished: () => void }): JSX.Element | null` — a default-exported-free named export, rendered as an absolutely-positioned, `pointerEvents="none"` overlay. Renders `null` when `visible` is `false`. When `visible` flips to `true`, it runs a ~2550ms sequence (descend → idle hold → resolve) and calls `onFinished()` once, ~450ms after the sequence completes.

- [ ] **Step 1: Write the component**

Create `components/auth/PlaneTrailSuccess.tsx`:

```tsx
import { useEffect } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  Extrapolation,
  FadeInUp,
  cancelAnimation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";

import { WingMark } from "../ui/WingMark";
import { coral, ink } from "../../constants/colors";
import { fonts } from "../../constants/typography";

const LARGE_PLANE = 56;
const TRAIL_WIDTH = 64;

// Three phases: descend from the header leaving a trail, hold with an idle
// bob while "loading", then fade + hand off. DESCEND_END/HOLD_END are the
// elapsed-time fraction of the total (650 + 1300 + 600 = 2550ms) at which
// each phase ends.
const DESCEND_MS = 650;
const HOLD_MS = 1300;
const RESOLVE_MS = 600;
const DESCEND_END = 0.25;
const HOLD_END = 0.76;

export function PlaneTrailSuccess({
  visible,
  originX,
  originY,
  onFinished,
}: {
  visible: boolean;
  originX: number;
  originY: number;
  onFinished: () => void;
}) {
  const { width: W, height: H } = useWindowDimensions();
  const restX = W / 2;
  const restY = H * 0.42;

  const progress = useSharedValue(0);
  const bobY = useSharedValue(0);
  const bobRotate = useSharedValue(0);

  // Must stay a component-scope function passed to scheduleOnRN by
  // reference — an inline closure created inside the worklet callback lives
  // on the UI runtime and crashes the app natively when invoked across
  // runtimes (see the same pattern previously in verify.tsx).
  const handleFinished = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(onFinished, 450);
  };

  useEffect(() => {
    if (!visible) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    progress.value = 0;
    progress.value = withSequence(
      withTiming(DESCEND_END, { duration: DESCEND_MS, easing: Easing.out(Easing.quad) }),
      withTiming(HOLD_END, { duration: HOLD_MS, easing: Easing.linear }),
      withTiming(1, { duration: RESOLVE_MS, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) scheduleOnRN(handleFinished);
      })
    );
    return () => {
      cancelAnimation(progress);
      cancelAnimation(bobY);
      cancelAnimation(bobRotate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Idle bob runs only during the hold phase — starts when descent finishes,
  // settles back to 0 right as resolve begins.
  useAnimatedReaction(
    () => progress.value,
    (cur, prev) => {
      if (prev === null) return;
      if (prev < DESCEND_END && cur >= DESCEND_END) {
        bobY.value = withRepeat(
          withSequence(
            withTiming(-4, { duration: 500, easing: Easing.inOut(Easing.sin) }),
            withTiming(4, { duration: 500, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          false
        );
        bobRotate.value = withRepeat(
          withSequence(
            withTiming(-4, { duration: 500, easing: Easing.inOut(Easing.sin) }),
            withTiming(4, { duration: 500, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          false
        );
      }
      if (prev < HOLD_END && cur >= HOLD_END) {
        cancelAnimation(bobY);
        cancelAnimation(bobRotate);
        bobY.value = withTiming(0, { duration: 150 });
        bobRotate.value = withTiming(0, { duration: 150 });
      }
    }
  );

  const fadeInOut = (p: number) =>
    interpolate(p, [0, 0.03, HOLD_END, 1], [0, 1, 1, 0], Extrapolation.CLAMP);

  const trailStyle = useAnimatedStyle(() => {
    const grownHeight = interpolate(
      progress.value,
      [0, DESCEND_END, 1],
      [0, restY - originY, restY - originY],
      Extrapolation.CLAMP
    );
    return {
      position: "absolute" as const,
      left: restX - TRAIL_WIDTH / 2,
      top: originY,
      width: TRAIL_WIDTH,
      height: grownHeight,
      borderRadius: TRAIL_WIDTH / 2,
      overflow: "hidden" as const,
      opacity: fadeInOut(progress.value),
    };
  });

  const planeStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const cx = interpolate(p, [0, DESCEND_END], [originX, restX], Extrapolation.CLAMP);
    const cy = interpolate(p, [0, DESCEND_END], [originY, restY], Extrapolation.CLAMP);
    const rot = interpolate(p, [0, DESCEND_END], [-6, 0], Extrapolation.CLAMP);
    return {
      position: "absolute" as const,
      opacity: fadeInOut(p),
      transform: [
        { translateX: cx - LARGE_PLANE / 2 },
        { translateY: cy - LARGE_PLANE / 2 + bobY.value },
        { rotate: `${rot + bobRotate.value}deg` },
      ],
    };
  });

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={trailStyle}>
        <LinearGradient
          colors={["transparent", "rgba(244,169,192,0.7)", coral[500]]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View style={planeStyle}>
        <WingMark size={LARGE_PLANE} color={coral[500]} />
      </Animated.View>

      <Animated.View
        entering={FadeInUp.duration(300).delay(DESCEND_MS + HOLD_MS)}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: restY - 20,
          alignItems: "center",
        }}
      >
        <Animated.Text
          style={{
            fontFamily: fonts.display,
            fontSize: 36,
            lineHeight: 40,
            letterSpacing: -0.5,
            color: ink[900],
          }}
        >
          You&apos;re in.
        </Animated.Text>
      </Animated.View>
    </View>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: no errors related to `components/auth/PlaneTrailSuccess.tsx` (the file isn't imported anywhere yet, so this just confirms the file itself is valid TypeScript).

- [ ] **Step 3: Commit**

```bash
git add components/auth/PlaneTrailSuccess.tsx
git commit -m "$(cat <<'EOF'
Add PlaneTrailSuccess animation component

Self-contained plane-flies-down-leaving-a-trail success animation, not yet wired into any screen.
EOF
)"
```

---

### Task 2: Wire `PlaneTrailSuccess` into `verify.tsx`, remove the old orbit-loop animation

**Files:**
- Modify: `app/(auth)/verify.tsx` (full replacement — see below)

**Interfaces:**
- Consumes: `PlaneTrailSuccess` from Task 1, exact props `{ visible, originX, originY, onFinished }`.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `app/(auth)/verify.tsx` with:

```tsx
import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  cancelAnimation,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { Button } from "../../components/ui/Button";
import { WingMark } from "../../components/ui/WingMark";
import { PlaneTrailSuccess } from "../../components/auth/PlaneTrailSuccess";
import { useAuthStore } from "../../store/auth";
import { coral, ink, surface } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { radii } from "../../constants/spacing";

const HEADER_PLANE = 18;

function ChevronLeft() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke={ink[500]}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function Verify() {
  const insets = useSafeAreaInsets();
  const { phone } = useLocalSearchParams<{ phone: string }>();

  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const sendOtp = useAuthStore((s) => s.sendOtp);
  const isVerifying = useAuthStore((s) => s.isVerifying);
  const isSendingOtp = useAuthStore((s) => s.isSendingOtp);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const inputRef = useRef<TextInput>(null);
  const headerMarkRef = useRef<View>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [token, setToken] = useState("");
  const [cooldown, setCooldown] = useState(60);
  const [showSuccess, setShowSuccess] = useState(false);
  const [headerX, setHeaderX] = useState(0);
  const [headerY, setHeaderY] = useState(0);

  const formOpacity = useSharedValue(1);
  const formFadeStyle = useAnimatedStyle(() => ({ opacity: formOpacity.value }));

  const startCooldown = () => {
    setCooldown(60);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    startCooldown();
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => {
      clearTimeout(focusTimer);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      cancelAnimation(formOpacity);
    };
  }, []);

  const handleTokenChange = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 6);
    setToken(digits);
    clearError();
    if (digits.length === 6) {
      void handleVerify(digits);
    }
  };

  const handleVerify = async (digits: string) => {
    const ok = await verifyOtp(phone, digits);
    if (ok) triggerSuccessAnimation();
  };

  const handleResend = async () => {
    if (cooldown > 0 || isSendingOtp) return;
    setToken("");
    clearError();
    const ok = await sendOtp(phone);
    if (ok) startCooldown();
  };

  const triggerSuccessAnimation = () => {
    inputRef.current?.blur();
    headerMarkRef.current?.measureInWindow((x, y, width, height) => {
      setHeaderX(x + width / 2);
      setHeaderY(y + height / 2);
      formOpacity.value = withTiming(0, { duration: 250 });
      setShowSuccess(true);
    });
  };

  const formattedPhone = phone
    ? `+1 (${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`
    : "";

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Top bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: insets.top + 16,
            paddingHorizontal: 24,
          }}
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ChevronLeft />
          </Pressable>
          <View
            ref={headerMarkRef}
            collapsable={false}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            {!showSuccess && <WingMark size={HEADER_PLANE} color={coral[500]} />}
            <Text style={{ fontFamily: fonts.display, fontSize: 20, color: ink[900] }}>
              Wing
            </Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* Entering animation and animated opacity live on separate views —
            combining them on one view makes Reanimated fight over `opacity`. */}
        <Animated.View
          entering={FadeInUp.duration(260).delay(200)}
          style={{ flex: 1 }}
        >
        <Animated.View
          style={[
            formFadeStyle,
            {
              flex: 1,
              paddingHorizontal: 24,
              paddingTop: 40,
              justifyContent: "space-between",
              paddingBottom: insets.bottom + 24,
            },
          ]}
        >
          {/* Top group */}
          <View>
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 36,
                lineHeight: 40,
                letterSpacing: -0.5,
                color: ink[900],
              }}
            >
              Check your{"\n"}texts
            </Text>
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: 16,
                lineHeight: 24,
                color: ink[500],
                marginTop: 8,
              }}
            >
              We sent a 6-digit code to {formattedPhone}
            </Text>

            {/* OTP digit boxes — tapping anywhere focuses the hidden input */}
            <Pressable
              onPress={() => inputRef.current?.focus()}
              style={{
                flexDirection: "row",
                gap: 10,
                justifyContent: "center",
                marginTop: 40,
                opacity: isVerifying ? 0.5 : 1,
              }}
            >
              {Array.from({ length: 6 }, (_, i) => {
                const char = token[i] ?? "";
                const isFilled = i < token.length;
                const isActive = i === token.length && !isVerifying;
                return (
                  <View
                    key={i}
                    style={{
                      width: 48,
                      height: 60,
                      borderRadius: radii.md,
                      borderWidth: isActive ? 1.5 : 1,
                      borderColor: isActive ? coral[500] : isFilled ? ink[700] : ink[300],
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: surface.cream,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: fonts.bodyMedium,
                        fontSize: 24,
                        color: ink[900],
                      }}
                    >
                      {char}
                    </Text>
                  </View>
                );
              })}
            </Pressable>

            {/* Hidden input — single input so iOS SMS autofill works correctly */}
            <TextInput
              ref={inputRef}
              value={token}
              onChangeText={handleTokenChange}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              maxLength={6}
              style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
            />

            {error !== null && (
              <Text
                style={{
                  fontFamily: fonts.body,
                  fontSize: 14,
                  lineHeight: 20,
                  color: coral[500],
                  textAlign: "center",
                  marginTop: 12,
                }}
              >
                {error}
              </Text>
            )}
          </View>

          {/* Bottom group */}
          <View style={{ gap: 16, paddingTop: 24 }}>
            <Button
              title="Verify"
              disabled={token.length < 6 || isVerifying}
              loading={isVerifying}
              onPress={() => { void handleVerify(token); }}
            />

            <Pressable
              onPress={() => { void handleResend(); }}
              disabled={cooldown > 0 || isSendingOtp}
              hitSlop={12}
              style={{ alignItems: "center" }}
            >
              <Text
                style={{
                  fontFamily: fonts.body,
                  fontSize: 15,
                  color: cooldown > 0 ? ink[300] : coral[500],
                  textAlign: "center",
                }}
              >
                {isSendingOtp
                  ? "Sending…"
                  : cooldown > 0
                    ? `Resend code in ${cooldown}s`
                    : "Resend code"}
              </Text>
            </Pressable>

            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: 12,
                lineHeight: 16,
                color: ink[500],
                textAlign: "center",
              }}
            >
              By continuing you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
        </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>

      <PlaneTrailSuccess
        visible={showSuccess}
        originX={headerX}
        originY={headerY}
        onFinished={() => router.replace("/(auth)/intent")}
      />
    </View>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: no errors. If errors reference unused imports, double check against the file above — every import listed is used at least once in the file.

- [ ] **Step 3: Commit**

```bash
git add app/\(auth\)/verify.tsx
git commit -m "$(cat <<'EOF'
Replace orbit-loop success animation with PlaneTrailSuccess

Swaps verify.tsx's inline contrail/orbit animation for the new
plane-flies-down-with-a-trail component, matching the approved design spec.
EOF
)"
```

---

### Task 3: Manual verification + CLAUDE.md update

**Files:**
- Modify: `CLAUDE.md` (File Structure table only)

- [ ] **Step 1: Run the app and walk through the flow**

Start the dev server (e.g. `npx expo start`) and, on a simulator or device:
1. Go through phone entry → enter a code → land on `Verify`.
2. Enter/autofill a 6-digit code that verifies successfully.
3. Confirm: the header WingMark disappears the instant verification succeeds, a plane flies down from that same spot leaving a coral/blush trail behind it, the plane settles and does a small idle bob for roughly a second, then the trail and plane fade out, "You're in." appears briefly, and the screen navigates to `/(auth)/intent` ("What brings you to Wing?").
4. Confirm no console errors/warnings appear during the sequence.

If anything looks wrong (timing, position, color), it's fine to hand-tune the constants in `components/auth/PlaneTrailSuccess.tsx` (`DESCEND_MS`, `HOLD_MS`, `RESOLVE_MS`, `restY`, `TRAIL_WIDTH`) — re-run typecheck and this manual walk-through after any tweak.

- [ ] **Step 2: Update CLAUDE.md's File Structure table**

In `/Users/eastonlovell/Wing-Dating-App/CLAUDE.md`, find the File Structure section's `/components` block:

```
/components
  /ui                  — Button, Card, Avatar, Input, Badge
  /intro               — IntroCard, IntroNote, MatchmakerChip
  /chat                — MessageBubble, ChatInput
```

Replace with:

```
/components
  /ui                  — Button, Card, Avatar, Input, Badge
  /intro               — IntroCard, IntroNote, MatchmakerChip
  /chat                — MessageBubble, ChatInput
  /auth                — PlaneTrailSuccess (OTP-verified success animation)
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
Document PlaneTrailSuccess in CLAUDE.md file structure
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** component/data-flow split (Task 1+2), trail visual treatment and brand-only gradient (Task 1), plane with no face (Task 1), three-phase timeline with exact durations (Task 1), haptics kept at the same two points (Task 1), "You're in." kept (Task 1), old orbit-loop fully removed (Task 2), edge cases — cleanup on unmount and window-size responsiveness — covered (Task 1's `useEffect` cleanup and `useWindowDimensions`). Manual verification substitutes for the "no automated tests exist" reality noted in the spec (Task 3).
- **Placeholder scan:** none found — every step has complete, runnable code.
- **Type consistency:** `PlaneTrailSuccess` props (`visible: boolean; originX: number; originY: number; onFinished: () => void`) match exactly between Task 1's definition and Task 2's usage.
