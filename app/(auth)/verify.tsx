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
import Svg, { Path } from "react-native-svg";

import { Button } from "../../components/ui/Button";
import { WingMark } from "../../components/ui/WingMark";
import { useAuthStore } from "../../store/auth";
import { coral, ink, surface } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { radii } from "../../constants/spacing";

const LARGE_PLANE = 56;
const HEADER_PLANE = 18;
const START_SCALE = HEADER_PLANE / LARGE_PLANE;

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
  const headerMarkX = useSharedValue(0);
  const headerMarkY = useSharedValue(0);
  const screenCX = useSharedValue(0);
  const screenCY = useSharedValue(0);

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

  const triggerSuccessAnimation = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    headerMarkRef.current?.measureInWindow((x, y, width, height) => {
      headerMarkX.value = x + width / 2 - LARGE_PLANE / 2;
      headerMarkY.value = y + height / 2 - LARGE_PLANE / 2;
      screenCX.value = W / 2 - LARGE_PLANE / 2;
      screenCY.value = H / 2 - LARGE_PLANE / 2 - 28;

      setShowSuccess(true);

      planeScale.value = START_SCALE;
      planeScale.value = withDelay(
        280,
        withSpring(1.0, { mass: 0.5, damping: 11, stiffness: 160 })
      );

      successProgress.value = withSequence(
        withTiming(0.25, { duration: 300, easing: Easing.out(Easing.quad) }),
        withTiming(1.0, { duration: 900, easing: Easing.out(Easing.cubic) }, (finished) => {
          if (finished) {
            scheduleOnRN(() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setTimeout(() => router.replace("/(auth)/onboarding"), 600);
            });
          }
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

  const flyerStyle = useAnimatedStyle(() => {
    const p = successProgress.value;
    const tx = interpolate(
      p,
      [0, 0.25, 1.0],
      [headerMarkX.value, headerMarkX.value, screenCX.value],
      Extrapolation.CLAMP
    );
    const ty = interpolate(
      p,
      [0, 0.25, 1.0],
      [headerMarkY.value, headerMarkY.value, screenCY.value],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(p, [0, 0.03, 1], [0, 1, 1], Extrapolation.CLAMP);
    return {
      opacity,
      position: "absolute",
      transform: [
        { translateX: tx },
        { translateY: ty },
        { scale: planeScale.value },
        { rotate: "-8deg" },
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

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{
      scale: interpolate(
        successProgress.value,
        [0.55, 0.82, 1.0],
        [0, 1.15, 1.0],
        Extrapolation.CLAMP
      ),
    }],
    opacity: interpolate(
      successProgress.value,
      [0.55, 0.68, 1.0],
      [0, 0.45, 0.25],
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

        <Animated.View
          entering={FadeInUp.duration(260).delay(200)}
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
      </KeyboardAvoidingView>

      {/* Success animation layer — absolutely positioned, non-interactive */}
      {showSuccess && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {/* Warm coral tint wash */}
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: coral[100] }, tintStyle]}
          />

          {/* Halo circle behind the plane */}
          <Animated.View
            style={[
              {
                position: "absolute",
                width: 128,
                height: 128,
                borderRadius: 64,
                backgroundColor: coral[100],
                alignSelf: "center",
                top: H / 2 - 64 - 28,
              },
              haloStyle,
            ]}
          />

          {/* Flying WingMark — travels from header position to screen center */}
          <Animated.View style={flyerStyle}>
            <WingMark size={LARGE_PLANE} color={coral[500]} />
          </Animated.View>

          {/* "You're in." — rises into view as the plane lands */}
          <Animated.View
            entering={FadeInUp.duration(220).delay(980)}
            style={{
              position: "absolute",
              alignSelf: "center",
              top: H / 2 + LARGE_PLANE / 2 - 28 + 20,
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
