import { useEffect } from "react";
import { View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WingMark } from "../ui/WingMark";
import { Button } from "../ui/Button";
import { coral, blush, ink, surface } from "../../constants/colors";
import { fonts } from "../../constants/typography";

const COPY = {
  "wing-me": {
    headline: "You're in the loop.",
    subhead:
      "When a friend has someone in mind, you'll get the note here first.",
  },
  "wing-somebody": {
    headline: "Wingman mode: on.",
    subhead: "Suggest an intro for your friend whenever inspiration strikes.",
  },
} as const;

// The resolution of onboarding, not another step — no step dots, no back button.
export function CelebrationStep({
  intent,
  onContinue,
}: {
  intent?: string;
  onContinue: () => void;
}) {
  const insets = useSafeAreaInsets();
  const copy = COPY[intent === "wing-somebody" ? "wing-somebody" : "wing-me"];
  const markScale = useSharedValue(0.6);

  useEffect(() => {
    markScale.value = withSpring(1, { mass: 0.5, damping: 10, stiffness: 160 });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [markScale]);

  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: markScale.value }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      {/* Sunset hero — same treatment as the welcome + intent screens */}
      <LinearGradient
        colors={[coral[500], coral[300], blush[300]]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{
          height: "46%",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: insets.top,
        }}
      >
        <Animated.View style={markStyle}>
          <WingMark size={64} color="#FFFFFF" />
        </Animated.View>
      </LinearGradient>

      <View
        style={{
          flex: 1,
          paddingHorizontal: 24,
          paddingTop: 40,
          paddingBottom: insets.bottom + 24,
          justifyContent: "space-between",
        }}
      >
        <Animated.View entering={FadeInDown.duration(280).delay(120)}>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 38,
              lineHeight: 44,
              letterSpacing: -0.5,
              color: ink[900],
            }}
          >
            {copy.headline}
          </Text>
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: 16,
              lineHeight: 24,
              color: ink[500],
              marginTop: 16,
            }}
          >
            {copy.subhead}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(260).delay(220)}>
          <Button title="Let's go" onPress={onContinue} />
        </Animated.View>
      </View>
    </View>
  );
}
