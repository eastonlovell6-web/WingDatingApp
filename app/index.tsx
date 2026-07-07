import { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import Svg, { Path } from "react-native-svg";

import { Button } from "../components/ui/Button";
import { WingMark } from "../components/ui/WingMark";
import { coral, blush, ink, surface } from "../constants/colors";
import { fonts } from "../constants/typography";

function ArrowRight({ color = "#FFFFFF", size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12h15M13 6l6 6-6 6"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const headlineStyle = {
  fontFamily: fonts.display,
  fontSize: 42,
  lineHeight: 46,
  letterSpacing: -1,
} as const;

const FLYER_SIZE = 30;
// Three phases: a leisurely on-screen loop, a steady paint-sweep under the
// word, then settle + fade. The middle is linear so the coral visibly tracks
// the plane (not a blur). Kept slow + deliberate — it's a hero moment.
const FLY_IN_MS = 1800;
const SWEEP_MS = 650;
const SETTLE_MS = 550;

export default function GetStarted() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Drives the whole reveal: 0 = idle (word is black), 1 = painted coral.
  const progress = useSharedValue(0);
  // Measured on-screen rect of the "wingman." word, shared with the flight worklet.
  const wx = useSharedValue(0);
  const wy = useSharedValue(0);
  const ww = useSharedValue(0);
  const wh = useSharedValue(0);

  const wordRef = useRef<View>(null);
  const [wordWidth, setWordWidth] = useState(0); // fixed width for the coral overlay copy

  const fireHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  const goToPhoneEntry = () =>
    router.push({ pathname: "/(auth)", params: { context: "new" } });

  // Buzz once the moment the paint reaches the word.
  useAnimatedReaction(
    () => progress.value,
    (cur, prev) => {
      if (prev !== null && prev < 0.46 && cur >= 0.46) {
        scheduleOnRN(fireHaptic);
      }
    }
  );

  const handleGetStarted = () => {
    wordRef.current?.measureInWindow((x, y, width, height) => {
      if (!width) return;
      wx.value = x;
      wy.value = y;
      ww.value = width;
      wh.value = height;
      setWordWidth(width);
      progress.value = 0;
      progress.value = withSequence(
        withTiming(0.46, { duration: FLY_IN_MS, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.82, { duration: SWEEP_MS, easing: Easing.linear }),
        withTiming(1, { duration: SETTLE_MS, easing: Easing.in(Easing.quad) }, (finished) => {
          if (finished) scheduleOnRN(goToPhoneEntry);
        })
      );
    });
  };

  const handleSignIn = () => {
    router.push({ pathname: "/(auth)", params: { context: "returning" } });
  };

  // Coral "paint" reveal — width grows left→right, in lockstep with the plane's sweep.
  const wipeStyle = useAnimatedStyle(() => ({
    width: interpolate(
      progress.value,
      [0, 0.46, 0.82, 1],
      [0, 0, ww.value, ww.value],
      Extrapolation.CLAMP
    ),
  }));

  // The coral plane: swoops around the screen, then its center rides the paint
  // front along the underline of the word (so it visibly "pulls" the coral on).
  const flyerStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const lineY = wy.value + wh.value * 0.62; // skim just under the word's body
    const wordStart = wx.value;
    const wordEnd = wx.value + ww.value;

    // Loop stays up in the gradient (x within ~18%–76% of width) where the
    // white plane has contrast, then dives down to the word's left edge to sweep.
    const loop = [0, 0.07, 0.15, 0.23, 0.31, 0.4];
    const cx = interpolate(
      p,
      [...loop, 0.46, 0.82, 0.91, 1],
      [
        W * 0.4, W * 0.66, W * 0.76, W * 0.56, W * 0.3, W * 0.2,
        wordStart, wordEnd, wordEnd + W * 0.05, wordEnd + W * 0.05,
      ]
    );
    const cy = interpolate(
      p,
      [...loop, 0.46, 0.82, 0.91, 1],
      [
        H * 0.22, H * 0.14, H * 0.24, H * 0.34, H * 0.26, H * 0.36,
        lineY, lineY, lineY + 12, lineY + 30,
      ]
    );
    const rot = interpolate(
      p,
      [0, 0.15, 0.31, 0.4, 0.46, 0.82, 1],
      [-10, 40, 120, 60, -8, -8, -6]
    );
    const opacity = interpolate(p, [0, 0.04, 0.94, 1], [0, 1, 1, 0]);

    return {
      opacity,
      transform: [
        { translateX: cx - FLYER_SIZE / 2 },
        { translateY: cy - FLYER_SIZE / 2 },
        { rotate: `${rot}deg` },
      ],
    };
  });

  // Cross-fade a white plane (loops over the gradient — needs contrast) into a
  // coral one (dives onto the cream to paint). Opacity animates reliably on web
  // + native, unlike animated SVG fill.
  const whiteFade = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 0.47], [1, 1, 0], Extrapolation.CLAMP),
  }));
  const coralFade = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.4, 0.47, 1], [0, 1, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      <StatusBar style="light" />

      {/* Sunset hero — bleeds under the status bar to the top edge. */}
      <Animated.View entering={FadeIn.duration(400)}>
        <LinearGradient
          colors={[coral[500], coral[300], blush[300]]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{
            height: H * 0.46,
            alignItems: "center",
            justifyContent: "center",
            paddingTop: insets.top,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ transform: [{ rotate: "-8deg" }] }}>
              <WingMark size={34} />
            </View>
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 52,
                color: "#FFFFFF",
                letterSpacing: -1,
              }}
            >
              Wing
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Cream content */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 24,
          paddingTop: 40,
          paddingBottom: insets.bottom + 24,
          justifyContent: "space-between",
        }}
      >
        <Animated.View entering={FadeInDown.duration(260).delay(120)}>
          <Text style={[headlineStyle, { color: ink[900] }]}>
            Your type?{"\n"}Leave it to your
          </Text>

          {/* "wingman." — black base with a coral copy revealed left→right by the plane. */}
          <View ref={wordRef} collapsable={false} style={{ alignSelf: "flex-start" }}>
            <Text style={[headlineStyle, { color: ink[900] }]}>wingman.</Text>
            <Animated.View
              pointerEvents="none"
              style={[
                { position: "absolute", left: 0, top: 0, bottom: 0, overflow: "hidden" },
                wipeStyle,
              ]}
            >
              <Text style={[headlineStyle, { color: coral[500], width: wordWidth || undefined }]}>
                wingman.
              </Text>
            </Animated.View>
          </View>

          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: 18,
              lineHeight: 26,
              color: ink[500],
              marginTop: 40,
            }}
          >
            No swiping on strangers. Every match starts with a friend.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(260).delay(220)}>
          <Button
            title="Get started"
            onPress={handleGetStarted}
            rightIcon={<ArrowRight />}
          />

          <Pressable
            onPress={handleSignIn}
            hitSlop={12}
            style={{
              flexDirection: "row",
              justifyContent: "center",
              marginTop: 24,
            }}
          >
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: ink[900] }}>
              Already on Wing?{" "}
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 15, color: ink[500] }}>
              I have an account
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* Full-screen flight layer — sits above everything, never blocks touches. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { zIndex: 10 }, flyerStyle]}
      >
        <Animated.View style={whiteFade}>
          <WingMark size={FLYER_SIZE} color="#FFFFFF" />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, coralFade]}>
          <WingMark size={FLYER_SIZE} color={coral[500]} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
