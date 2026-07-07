import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WingMark } from "../../components/ui/WingMark";
import { coral, blush, plum, ink, surface, shadowTint } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { radii } from "../../constants/spacing";

export type OnboardingIntent = "wing-me" | "wing-somebody";

function IntentCard({
  title,
  subtitle,
  tintBg,
  tintColor,
  delay,
  onPress,
}: {
  title: string;
  subtitle: string;
  tintBg: string;
  tintColor: string;
  delay: number;
  onPress: () => void;
}) {
  return (
    <Animated.View entering={FadeInUp.duration(280).delay(delay)}>
      {/* Style must live on the inner View, not the Pressable — Pressable
          styles don't render on-device here (see Button.tsx pattern). */}
      <Pressable onPress={onPress}>
        {({ pressed }) => (
          <View
            style={{
              minHeight: 210,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: surface.paper,
              borderRadius: radii.xl,
              borderWidth: 1.5,
              borderColor: tintBg,
              paddingHorizontal: 28,
              shadowColor: shadowTint,
              shadowOpacity: 1,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 8 },
              elevation: 4,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            }}
          >
            <View style={{ flexShrink: 1, paddingRight: 16 }}>
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: 26,
                  lineHeight: 32,
                  letterSpacing: -0.4,
                  color: ink[900],
                }}
              >
                {title}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.body,
                  fontSize: 16,
                  lineHeight: 24,
                  color: ink[500],
                  marginTop: 6,
                }}
              >
                {subtitle}
              </Text>
            </View>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: radii.pill,
                backgroundColor: tintBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <WingMark size={24} color={tintColor} />
            </View>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function Intent() {
  const insets = useSafeAreaInsets();

  const choose = (intent: OnboardingIntent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/(auth)/onboarding", params: { intent } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      <StatusBar style="light" />

      {/* Sunset hero — same treatment as the welcome screen */}
      <LinearGradient
        colors={[coral[500], coral[300], blush[300]]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{
          paddingTop: insets.top + 40,
          paddingBottom: 64,
          paddingHorizontal: 24,
        }}
      >
        <Animated.View entering={FadeInUp.duration(280).delay(80)}>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 38,
              lineHeight: 44,
              letterSpacing: -0.5,
              color: "#FFFFFF",
            }}
          >
            What brings you{"\n"}to Wing?
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInUp.duration(280).delay(140)}>
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: 16,
              lineHeight: 22,
              color: "rgba(255,255,255,0.85)",
              marginTop: 12,
            }}
          >
            You can always change this later
          </Text>
        </Animated.View>
      </LinearGradient>

      <View
        style={{
          flex: 1,
          paddingHorizontal: 24,
          paddingTop: 40,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <IntentCard
          title="Wing me"
          subtitle="I'm ready to be introduced"
          tintBg={coral[100]}
          tintColor={coral[500]}
          delay={160}
          onPress={() => choose("wing-me")}
        />
        <View style={{ height: 20 }} />
        <IntentCard
          title="I'll wing somebody"
          subtitle="I want to set up a friend"
          tintBg={plum[100]}
          tintColor={plum[500]}
          delay={260}
          onPress={() => choose("wing-somebody")}
        />
      </View>
    </View>
  );
}
