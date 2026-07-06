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
  iconColor,
  delay,
  onPress,
}: {
  title: string;
  subtitle: string;
  iconColor: string;
  delay: number;
  onPress: () => void;
}) {
  return (
    <Animated.View entering={FadeInUp.duration(280).delay(delay)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          backgroundColor: surface.paper,
          borderRadius: radii.lg,
          paddingVertical: 24,
          paddingHorizontal: 24,
          shadowColor: shadowTint,
          shadowOpacity: 1,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
          elevation: 4,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <WingMark size={20} color={iconColor} />
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 22,
              lineHeight: 28,
              letterSpacing: -0.3,
              color: ink[900],
              marginLeft: 10,
            }}
          >
            {title}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: 15,
            lineHeight: 22,
            color: ink[500],
            marginTop: 6,
          }}
        >
          {subtitle}
        </Text>
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
      </LinearGradient>

      <View style={{ flex: 1, paddingHorizontal: 24, marginTop: 24 }}>
        <IntentCard
          title="Wing Me"
          subtitle="I'm ready to be introduced"
          iconColor={coral[500]}
          delay={160}
          onPress={() => choose("wing-me")}
        />
        <View style={{ height: 16 }} />
        <IntentCard
          title="I'll wing somebody"
          subtitle="I want to set up a friend"
          iconColor={plum[500]}
          delay={260}
          onPress={() => choose("wing-somebody")}
        />
      </View>
    </View>
  );
}
