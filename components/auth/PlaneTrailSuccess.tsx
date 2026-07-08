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
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";

import { WingMark } from "../ui/WingMark";
import { coral, ink } from "../../constants/colors";
import { fonts } from "../../constants/typography";

const LARGE_PLANE = 56;
const TRAIL_WIDTH = 64;

// Wispy speed-streaks that rush upward past the held plane during the hold
// phase — relative motion that sells "the plane is travelling", not sitting on
// a still screen. Each entry is a fixed lane; `phase` staggers them along the
// shared driver loop so the stream is continuous. x is offset from center.
const STREAKS = [
  { phase: 0.0, x: -22, w: 3, h: 34 },
  { phase: 0.17, x: 16, w: 2.5, h: 28 },
  { phase: 0.33, x: -8, w: 3, h: 40 },
  { phase: 0.5, x: 24, w: 2.5, h: 30 },
  { phase: 0.67, x: -26, w: 2.5, h: 26 },
  { phase: 0.83, x: 10, w: 3, h: 38 },
];

// A soft warm-coral highlight that swells and fades upward *inside* the trail —
// texture that makes the pill look like it's rushing past the plane without
// reading as hard stripes. Few, wide bands give long gentle ramps, so the light
// rolls through as a fluid coral gradient rather than sharp lines. The color
// stops stay vertically periodic (both ends transparent, evenly spaced), so
// translating the overlay up by exactly one period loops with no visible seam.
const FLOW_BANDS = 3;
const FLOW_OVERLAY_H = 720; // taller than any trail so it always covers the pill
const FLOW_PERIOD = FLOW_OVERLAY_H / FLOW_BANDS; // translate distance per loop
const FLOW_MS = 2000; // one period of upward drift — slow so it reads as fluid
const FLOW_COLORS: string[] = [];
const FLOW_LOCATIONS: number[] = [];
for (let i = 0; i <= FLOW_BANDS * 2; i++) {
  FLOW_LOCATIONS.push(i / (FLOW_BANDS * 2));
  FLOW_COLORS.push(i % 2 === 0 ? "transparent" : "rgba(255,196,170,0.34)");
}

// Three phases: descend from the header leaving a trail, hold with an idle
// bob while "loading", then fade + hand off. DESCEND_END/HOLD_END are the
// elapsed-time fraction of the total (650 + 1300 + 600 = 2550ms) at which
// each phase ends.
const DESCEND_MS = 650;
const HOLD_MS = 1300;
const RESOLVE_MS = 600;
const DESCEND_END = 0.25;
const HOLD_END = 0.76;

// The plane's vertical descent is driven separately from `progress` so it can
// overshoot: it flies *past* the rest point, then eases back up to settle on
// center. LAND_DOWN + LAND_SETTLE must equal DESCEND_MS so the plane is fully
// settled exactly when the hold/bob phase takes over (they mustn't fight).
// The plane dives from the header to a dwell point BELOW center, hovers there
// (gently bobbing) for the bulk of the sequence, then recoils upward and
// rockets off the bottom of the screen. Vertical position is tracked by
// `land`, where 1 == restY (screen center); >1 is below center, <1 above.
// Pixel offsets convert into that space so distances hold across screen sizes.
const ARRIVE_DOWN_MS = 420; // dive from header to just past the dwell point
const ARRIVE_SETTLE_MS = 240; // ease up onto the dwell point
const DWELL_PX = 130; // how far below center the plane hovers (clearly past the screen midpoint)
const ARRIVE_OVERSHOOT_PX = 26; // small dip below dwell on arrival, then settle up
const WINDUP_MS = 220; // recoil upward — anticipation before launch
const WINDUP_PX = 46; // how far it lifts on the recoil
const FLYOFF_MS = 380; // accelerate down + off the page (WINDUP + FLYOFF = RESOLVE_MS)

// WingMark's nose points right at 0deg and its body axis sits ~3deg above
// horizontal, so a straight-down nose needs 90 + ~3 = 93deg (not 90).
const PLANE_DOWN_DEG = 93;

// MUST be a worklet (or fully inlined). This is called from inside the
// useAnimatedStyle worklets below, which run on the UI runtime. Calling a
// plain (non-worklet) component-scope function from a worklet crashes the app
// natively on this stack (Reanimated 4 + react-native-worklets on the New
// Architecture) — no red box, straight to the home screen. Keep the 'worklet'
// directive; do not turn this back into an un-directived closure.
function fadeInOut(p: number): number {
  "worklet";
  return interpolate(p, [0, 0.03, HOLD_END, 1], [0, 1, 1, 0], Extrapolation.CLAMP);
}

// One wispy streak. `driver` loops 0->1 during the hold; `progress` gates the
// whole set to the hold window so streaks never show during descent/resolve.
// All math stays inlined in the worklet — no cross-runtime closure calls.
function Streak({
  driver,
  progress,
  restX,
  restY,
  phase,
  x,
  w,
  h,
}: {
  driver: SharedValue<number>;
  progress: SharedValue<number>;
  restX: number;
  restY: number;
  phase: number;
  x: number;
  w: number;
  h: number;
}) {
  const style = useAnimatedStyle(() => {
    const holdOpacity = interpolate(
      progress.value,
      [DESCEND_END, DESCEND_END + 0.04, HOLD_END - 0.06, HOLD_END],
      [0, 1, 1, 0],
      Extrapolation.CLAMP
    );
    const p = (driver.value + phase) % 1;
    const startY = restY + 70;
    const endY = restY - 150;
    const travelOpacity = interpolate(p, [0, 0.15, 0.7, 1], [0, 1, 1, 0], Extrapolation.CLAMP);
    return {
      position: "absolute" as const,
      left: restX + x - w / 2,
      top: startY + (endY - startY) * p,
      width: w,
      height: h,
      borderRadius: w / 2,
      overflow: "hidden" as const,
      opacity: holdOpacity * travelOpacity * 0.4,
    };
  });

  return (
    <Animated.View style={style} pointerEvents="none">
      <LinearGradient
        colors={["transparent", coral[300], "transparent"]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

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

  // `land` targets (1 == center): the below-center dwell, the upward recoil,
  // and the off-screen exit — all in land space.
  const dwellVal = 1 + DWELL_PX / (restY - originY);
  const windupVal = 1 + (DWELL_PX - WINDUP_PX) / (restY - originY);
  const exitVal = (H + LARGE_PLANE - originY) / (restY - originY);

  const progress = useSharedValue(0);
  const land = useSharedValue(0);
  const bobY = useSharedValue(0);
  const bobRotate = useSharedValue(0);
  const streak = useSharedValue(0);
  const flow = useSharedValue(0);

  // Must stay a component-scope function passed to scheduleOnRN by
  // reference — an inline closure created inside the worklet callback lives
  // on the UI runtime and crashes the app natively when invoked across
  // runtimes (see the same pattern previously in verify.tsx).
  // Fires when the plane has fully resolved and faded out. "You're in" fades
  // in on the now-empty screen (delayed by the same total), then we hold a
  // readable beat before handing off to the next screen.
  const handleFinished = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(onFinished, 1100);
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

    // Trail texture drifts upward the whole time — looped and seamless.
    flow.value = 0;
    flow.value = withRepeat(
      withTiming(1, { duration: FLOW_MS, easing: Easing.linear }),
      -1,
      false
    );

    // Vertical motion: dive to just past the dwell point, ease up onto it, then
    // start the idle bob (from the worklet callback so it hands off cleanly).
    // The recoil + fly-off is triggered later, at HOLD_END, in the reaction.
    land.value = 0;
    const arriveOvershoot = 1 + (DWELL_PX + ARRIVE_OVERSHOOT_PX) / (restY - originY);
    land.value = withSequence(
      withTiming(arriveOvershoot, { duration: ARRIVE_DOWN_MS, easing: Easing.out(Easing.quad) }),
      withTiming(dwellVal, { duration: ARRIVE_SETTLE_MS, easing: Easing.inOut(Easing.sin) }, (finished) => {
        if (finished) {
          bobY.value = withRepeat(
            withSequence(
              withTiming(-6, { duration: 520, easing: Easing.inOut(Easing.sin) }),
              withTiming(6, { duration: 520, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            false
          );
          bobRotate.value = withRepeat(
            withSequence(
              withTiming(-3, { duration: 520, easing: Easing.inOut(Easing.sin) }),
              withTiming(3, { duration: 520, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            false
          );
        }
      })
    );
    return () => {
      cancelAnimation(progress);
      cancelAnimation(land);
      cancelAnimation(bobY);
      cancelAnimation(bobRotate);
      cancelAnimation(streak);
      cancelAnimation(flow);
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
        // Continuous upward stream — one linear loop the streaks read off of.
        // (The idle bob is started from the landing callback, not here, so it
        // doesn't collide with the still-settling overshoot.)
        streak.value = 0;
        streak.value = withRepeat(
          withTiming(1, { duration: 900, easing: Easing.linear }),
          -1,
          false
        );
      }
      if (prev < HOLD_END && cur >= HOLD_END) {
        // Launch: stop the idle bob + streaks, recoil upward (anticipation),
        // then accelerate down and off the bottom of the screen.
        cancelAnimation(bobY);
        cancelAnimation(bobRotate);
        cancelAnimation(streak);
        bobY.value = withTiming(0, { duration: 120 });
        bobRotate.value = withTiming(0, { duration: 120 });
        land.value = withSequence(
          withTiming(windupVal, { duration: WINDUP_MS, easing: Easing.out(Easing.quad) }),
          withTiming(exitVal, { duration: FLYOFF_MS, easing: Easing.in(Easing.cubic) })
        );
      }
    }
  );

  const trailStyle = useAnimatedStyle(() => {
    // Trail bottom tracks the plane down to the dwell point, then holds at that
    // length (clamped) so the launch doesn't stretch it across the whole page —
    // it simply fades as the plane rockets away.
    const grownHeight = interpolate(
      land.value,
      [0, dwellVal],
      [0, restY + DWELL_PX - originY],
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

  // Upward-scrolling band overlay that lives inside the (clipped) trail.
  const flowStyle = useAnimatedStyle(() => ({
    position: "absolute" as const,
    left: 0,
    right: 0,
    top: 0,
    height: FLOW_OVERLAY_H,
    transform: [{ translateY: -flow.value * FLOW_PERIOD }],
  }));

  const planeStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const cx = interpolate(p, [0, DESCEND_END], [originX, restX], Extrapolation.CLAMP);
    // No CLAMP: land runs from 0 (header) past 1 (center) to exitVal, so cy
    // travels from the header, through center, down to below the screen.
    const cy = interpolate(land.value, [0, 1], [originY, restY]);
    const rot = interpolate(p, [0, DESCEND_END], [-6, PLANE_DOWN_DEG], Extrapolation.CLAMP);
    return {
      position: "absolute" as const,
      // Fade in on entrance, then stay solid — it exits by flying off-screen,
      // not by fading.
      opacity: interpolate(p, [0, 0.03], [0, 1], Extrapolation.CLAMP),
      // Warm drop shadow lifts the white plane off the coral trail so it stays
      // legible against a same-family background.
      shadowColor: "#5A1E14",
      shadowOpacity: 0.32,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
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
        <Animated.View style={flowStyle} pointerEvents="none">
          <LinearGradient
            colors={FLOW_COLORS as unknown as readonly [string, string, ...string[]]}
            locations={FLOW_LOCATIONS as unknown as readonly [number, number, ...number[]]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </Animated.View>

      {STREAKS.map((s, i) => (
        <Streak
          key={i}
          driver={streak}
          progress={progress}
          restX={restX}
          restY={restY + DWELL_PX}
          phase={s.phase}
          x={s.x}
          w={s.w}
          h={s.h}
        />
      ))}

      <Animated.View style={planeStyle}>
        <WingMark size={LARGE_PLANE} color="#FFFFFF" />
      </Animated.View>

      <Animated.View
        entering={FadeInUp.duration(300).delay(DESCEND_MS + HOLD_MS + RESOLVE_MS)}
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
