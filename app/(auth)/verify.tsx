import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Path } from "react-native-svg";

import { Button } from "../../components/ui/Button";
import { WingMark } from "../../components/ui/WingMark";
import { useAuthStore } from "../../store/auth";
import { coral, ink, surface } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { radii } from "../../constants/spacing";

const LARGE_PLANE = 56;
const HEADER_PLANE = 18;
const START_SCALE = HEADER_PLANE / LARGE_PLANE;

// The success "flight loop": the plane laps a dotted circular flight path
// (our loading spinner), then breaks off toward the next screen.
const ORBIT_R = 76;
const ORBIT_PAD = 10; // room for the stroke so it isn't clipped
const ORBIT_C = ORBIT_R + ORBIT_PAD; // center of the orbit box, local coords
const ORBIT_S = ORBIT_C * 2;

// Point on the orbit circle at `deg` (SVG y-down space; -90 is the top).
const orbitPt = (deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return `${ORBIT_C + ORBIT_R * Math.cos(rad)} ${ORBIT_C + ORBIT_R * Math.sin(rad)}`;
};
// Contrail arcs trailing the plane, which rides the top of the loop clockwise.
const TAIL_D = `M ${orbitPt(-200)} A ${ORBIT_R} ${ORBIT_R} 0 0 1 ${orbitPt(-90)}`;
const TAIL_HOT_D = `M ${orbitPt(-135)} A ${ORBIT_R} ${ORBIT_R} 0 0 1 ${orbitPt(-90)}`;

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
  const { width: W, height: H } = useWindowDimensions();
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

  // Success animation shared values
  const successProgress = useSharedValue(0);
  const planeScale = useSharedValue(START_SCALE);
  // Center of the header wing mark, measured when the animation starts.
  const headerX = useSharedValue(0);
  const headerY = useSharedValue(0);

  // Where the flight loop sits on screen (static per layout).
  const orbitCX = W / 2;
  const orbitCY = H / 2 - 40;
  const orbitTopY = orbitCY - ORBIT_R;

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
      cancelAnimation(successProgress);
      cancelAnimation(planeScale);
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

  // Runs on the RN runtime after the flight finishes. Must stay a
  // component-scope function passed to scheduleOnRN by reference — an inline
  // closure created inside the worklet callback lives on the UI runtime and
  // crashes the app natively when invoked across runtimes.
  const finishSuccess = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => router.replace("/(auth)/intent"), 450);
  };

  const triggerSuccessAnimation = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    headerMarkRef.current?.measureInWindow((x, y, width, height) => {
      headerX.value = x + width / 2;
      headerY.value = y + height / 2;

      setShowSuccess(true);

      planeScale.value = START_SCALE;
      planeScale.value = withDelay(
        160,
        withSpring(1.0, { mass: 0.5, damping: 11, stiffness: 160 })
      );

      successProgress.value = 0;
      successProgress.value = withSequence(
        // Leave the header and swoop down to the top of the flight loop.
        withTiming(0.22, { duration: 420, easing: Easing.out(Easing.quad) }),
        // Two laps around the loop — the "getting you in" loader moment.
        withTiming(0.78, { duration: 1300, easing: Easing.linear }),
        // Break off the loop and fly out toward the next screen.
        withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }, (finished) => {
          if (finished) scheduleOnRN(finishSuccess);
        })
      );
    });
  };

  // All animated styles derive from successProgress
  const contentFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(successProgress.value, [0, 0.25], [1, 0], Extrapolation.CLAMP),
  }));

  const headerMarkHideStyle = useAnimatedStyle(() => ({
    opacity: interpolate(successProgress.value, [0, 0.1], [1, 0], Extrapolation.CLAMP),
  }));

  // Free-flying plane: header → top of the loop, then (after the laps,
  // handled by the orbiting copy) top of the loop → off-screen right.
  const flyerStyle = useAnimatedStyle(() => {
    const p = successProgress.value;
    const cx = interpolate(
      p,
      [0, 0.1, 0.22, 0.78, 0.9, 1],
      [
        headerX.value,
        headerX.value + (orbitCX - headerX.value) * 0.35,
        orbitCX,
        orbitCX,
        W * 0.74,
        W + 90,
      ],
      Extrapolation.CLAMP
    );
    const cy = interpolate(
      p,
      [0, 0.1, 0.22, 0.78, 0.9, 1],
      [
        headerY.value,
        headerY.value + (orbitTopY - headerY.value) * 0.62,
        orbitTopY,
        orbitTopY,
        orbitTopY - H * 0.1,
        orbitTopY - H * 0.24,
      ],
      Extrapolation.CLAMP
    );
    const rot = interpolate(
      p,
      [0, 0.1, 0.22, 0.78, 1],
      [8, 14, 0, 0, -28],
      Extrapolation.CLAMP
    );
    // Visible on the way in and the way out; the orbiting copy covers the laps.
    const opacity = interpolate(
      p,
      [0, 0.03, 0.215, 0.222, 0.778, 0.785, 0.97, 1],
      [0, 1, 1, 0, 0, 1, 1, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      position: "absolute",
      transform: [
        { translateX: cx - LARGE_PLANE / 2 },
        { translateY: cy - LARGE_PLANE / 2 },
        { scale: planeScale.value },
        { rotate: `${rot}deg` },
      ],
    };
  });

  // The whole loop (track + contrail + plane) spins as one — the plane rides
  // the top of the circle, so rotating the box flies it clockwise with its
  // nose along the tangent, contrail trailing behind.
  const orbitStyle = useAnimatedStyle(() => {
    const p = successProgress.value;
    return {
      opacity: interpolate(
        p,
        [0.215, 0.222, 0.778, 0.785],
        [0, 1, 1, 0],
        Extrapolation.CLAMP
      ),
      transform: [
        {
          rotate: `${interpolate(
            p,
            [0.22, 0.36, 0.6, 0.78],
            [0, 210, 560, 720],
            Extrapolation.CLAMP
          )}deg`,
        },
      ],
    };
  });

  const tintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      successProgress.value,
      [0.1, 0.4, 1.0],
      [0, 0.28, 0.22],
      Extrapolation.CLAMP
    ),
  }));

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
            <Animated.View style={headerMarkHideStyle}>
              <WingMark size={HEADER_PLANE} color={coral[500]} />
            </Animated.View>
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
            contentFadeStyle,
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

      {/* Success animation layer — absolutely positioned, non-interactive */}
      {showSuccess && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {/* Warm coral tint wash */}
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: coral[100] }, tintStyle]}
          />

          {/* Flight loop — dotted flight path, contrail, and the lapping plane */}
          <Animated.View
            style={[
              {
                position: "absolute",
                left: orbitCX - ORBIT_C,
                top: orbitCY - ORBIT_C,
                width: ORBIT_S,
                height: ORBIT_S,
              },
              orbitStyle,
            ]}
          >
            <Svg width={ORBIT_S} height={ORBIT_S}>
              <Circle
                cx={ORBIT_C}
                cy={ORBIT_C}
                r={ORBIT_R}
                stroke={coral[300]}
                strokeOpacity={0.45}
                strokeWidth={2}
                strokeDasharray="1 12"
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d={TAIL_D}
                stroke={coral[300]}
                strokeOpacity={0.55}
                strokeWidth={4}
                strokeLinecap="round"
                fill="none"
              />
              <Path
                d={TAIL_HOT_D}
                stroke={coral[500]}
                strokeWidth={4}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
            <View
              style={{
                position: "absolute",
                left: ORBIT_C - LARGE_PLANE / 2,
                top: ORBIT_C - ORBIT_R - LARGE_PLANE / 2,
              }}
            >
              <WingMark size={LARGE_PLANE} color={coral[500]} />
            </View>
          </Animated.View>

          {/* Free-flying WingMark — header → loop, then loop → off-screen */}
          <Animated.View style={flyerStyle}>
            <WingMark size={LARGE_PLANE} color={coral[500]} />
          </Animated.View>

          {/* "You're in." — lands at the loop's center as the plane departs */}
          <Animated.View
            entering={FadeInUp.duration(300).delay(1740)}
            style={{
              position: "absolute",
              alignSelf: "center",
              top: orbitCY - 20,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 36,
                lineHeight: 40,
                letterSpacing: -0.5,
                color: ink[900],
              }}
            >
              You're in.
            </Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
}
