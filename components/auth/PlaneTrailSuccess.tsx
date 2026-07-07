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
