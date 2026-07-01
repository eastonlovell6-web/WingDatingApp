import { useEffect, useState } from "react";
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
  Easing,
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { Button } from "../../components/ui/Button";
import { WingMark } from "../../components/ui/WingMark";
import { useAuthStore } from "../../store/auth";
import { coral, ink, surface } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { radii } from "../../constants/spacing";

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

function formatPhone(digits: string): string {
  const d = digits.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

// Coral pill shown while the OTP is sending — replaces the Continue button.
function SendingView() {
  const planeY = useSharedValue(0);
  const planeRotate = useSharedValue(-10);
  const labelOpacity = useSharedValue(0);

  useEffect(() => {
    labelOpacity.value = withTiming(1, { duration: 200 });
    planeY.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 500, easing: Easing.inOut(Easing.sin) }),
        withTiming(2, { duration: 500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    planeRotate.value = withRepeat(
      withSequence(
        withTiming(-14, { duration: 500, easing: Easing.inOut(Easing.sin) }),
        withTiming(-6, { duration: 500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
    return () => {
      cancelAnimation(planeY);
      cancelAnimation(planeRotate);
      cancelAnimation(labelOpacity);
    };
  }, []);

  const planeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: planeY.value },
      { rotate: `${planeRotate.value}deg` },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={{
        height: 60,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        paddingHorizontal: 28,
        borderRadius: radii.pill,
        backgroundColor: coral[500],
        shadowColor: coral[500],
        shadowOpacity: 0.4,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
      }}
    >
      <Animated.View style={planeStyle}>
        <WingMark size={20} color="#FFFFFF" />
      </Animated.View>
      <Animated.Text
        style={[
          labelStyle,
          {
            fontFamily: fonts.bodyMedium,
            fontSize: 17,
            letterSpacing: 0.2,
            color: "#FFFFFF",
          },
        ]}
      >
        On its way...
      </Animated.Text>
    </Animated.View>
  );
}

export default function PhoneEntry() {
  const insets = useSafeAreaInsets();
  const { context } = useLocalSearchParams<{ context?: string }>();
  const [rawDigits, setRawDigits] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const sendOtp = useAuthStore((s) => s.sendOtp);
  const isSendingOtp = useAuthStore((s) => s.isSendingOtp);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const subtext =
    context === "returning"
      ? "Welcome back. We'll send you a quick code."
      : "We'll send you a code — takes about ten seconds.";

  const handleChange = (text: string) => {
    setRawDigits(text.replace(/\D/g, "").slice(0, 10));
    if (error) clearError();
  };

  const handleContinue = async () => {
    const e164 = `+1${rawDigits}`;
    const ok = await sendOtp(e164);
    if (ok) {
      router.push({ pathname: "/(auth)/verify", params: { phone: e164 } });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Top bar — fixed, sits above the animated content */}
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
            <WingMark size={18} color={coral[500]} />
            <Text
              style={{ fontFamily: fonts.display, fontSize: 20, color: ink[900] }}
            >
              Wing
            </Text>
          </View>
          {/* Phantom spacer keeps wordmark optically centered */}
          <View style={{ width: 24 }} />
        </View>

        <Animated.View
          entering={FadeInUp.duration(260).delay(200)}
          style={{
            flex: 1,
            paddingHorizontal: 24,
            paddingTop: 40,
            justifyContent: "space-between",
            paddingBottom: insets.bottom + 24,
          }}
        >
          {/* Top content group */}
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
              What's your{"\n"}number?
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
              {subtext}
            </Text>

            {/* Phone input row */}
            <View
              style={{
                flexDirection: "row",
                height: 60,
                borderRadius: radii.md,
                borderWidth: isFocused ? 1.5 : 1,
                borderColor: isFocused ? coral[500] : ink[300],
                marginTop: 40,
                overflow: "hidden",
              }}
            >
              {/* Country prefix — US only for v1 */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  gap: 6,
                  borderRightWidth: 1,
                  borderRightColor: ink[300],
                }}
              >
                <Text style={{ fontSize: 20 }}>🇺🇸</Text>
                <Text
                  style={{ fontFamily: fonts.body, fontSize: 16, color: ink[500] }}
                >
                  +1
                </Text>
              </View>

              <TextInput
                value={formatPhone(rawDigits)}
                onChangeText={handleChange}
                keyboardType="phone-pad"
                placeholder="(555) 000-0000"
                placeholderTextColor={ink[300]}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                returnKeyType="done"
                maxLength={14}
                style={{
                  flex: 1,
                  height: "100%",
                  paddingHorizontal: 16,
                  fontFamily: fonts.body,
                  fontSize: 18,
                  color: ink[900],
                }}
              />
            </View>
          </View>

          {/* Bottom group — floated down by space-between */}
          <View style={{ paddingTop: 24 }}>
            {isSendingOtp ? (
              <SendingView />
            ) : (
              <Button
                title="Continue"
                disabled={rawDigits.length < 10}
                onPress={() => { void handleContinue(); }}
              />
            )}

            {error !== null && (
              <Text
                style={{
                  fontFamily: fonts.body,
                  fontSize: 14,
                  lineHeight: 20,
                  color: coral[500],
                  textAlign: "center",
                  marginTop: 8,
                }}
              >
                {error}
              </Text>
            )}

            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: 12,
                lineHeight: 16,
                color: ink[500],
                textAlign: "center",
                marginTop: 16,
              }}
            >
              By continuing you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}
