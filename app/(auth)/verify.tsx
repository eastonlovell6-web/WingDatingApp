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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View
              ref={headerMarkRef}
              collapsable={false}
              style={{ opacity: showSuccess ? 0 : 1 }}
            >
              <WingMark size={HEADER_PLANE} color={coral[500]} />
            </View>
            <Text style={{ fontFamily: fonts.display, fontSize: 20, color: ink[900] }}>
              Wing
            </Text>
            {/* Balances the icon + gap so the word "Wing" lands on true
                screen-center, aligned with the trail / plane / "You're in". */}
            <View style={{ width: HEADER_PLANE }} />
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

      {showSuccess && (
        <PlaneTrailSuccess
          visible={showSuccess}
          originX={headerX}
          originY={headerY}
          onFinished={() => router.replace("/(auth)/intent")}
        />
      )}
    </View>
  );
}
