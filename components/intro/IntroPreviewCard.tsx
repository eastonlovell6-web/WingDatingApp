import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Avatar } from "../ui/Avatar";
import { TruncatedText } from "../ui/TruncatedText";
import { coral, gradients, ink, plum, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { elevation } from "../../constants/elevation";
import type { IntroPreview } from "./mockIntros";

interface IntroPreviewCardProps {
  intro: IntroPreview;
  index: number;
  /** "hero" is the full-detail card for the most recent intro; "stack" is
   * the compact "next up" row for additional pending intros. */
  variant?: "hero" | "stack";
  onPress?: () => void;
}

const spring = { mass: 0.4, damping: 12, stiffness: 220 };

export function IntroPreviewCard({ intro, index, variant = "hero", onPress }: IntroPreviewCardProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: router.push(`/intro/${intro.id}`)
    onPress?.();
  }

  const pressHandlers = {
    onPressIn: () => (scale.value = withSpring(0.98, spring)),
    onPressOut: () => (scale.value = withSpring(1, spring)),
    onPress: handlePress,
  };

  const accessibilityLabel = `Intro from ${intro.matchmakerName}: ${intro.note}`;

  if (variant === "stack") {
    return (
      <Animated.View entering={FadeInDown.duration(220).delay(index * 60)}>
        <Pressable
          {...pressHandlers}
          accessible
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          <Animated.View
            style={[
              {
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[4],
                backgroundColor: surface.paper,
                borderRadius: radii.md,
                padding: spacing[4],
              },
              elevation.xs,
              animatedStyle,
            ]}
          >
            <View
              style={{
                borderRadius: radii.pill,
                borderWidth: 1.5,
                borderColor: plum[100],
                padding: 2,
              }}
            >
              <Avatar name={intro.matchAvatarName} size={36} imageUri={intro.matchAvatarUri} />
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontFamily: fonts.monoMedium,
                  fontSize: fontSize["2xs"][0],
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: coral[500],
                }}
              >
                Intro from {intro.matchmakerName}
              </Text>
              <TruncatedText
                numberOfLines={1}
                style={{
                  fontFamily: fonts.body,
                  fontSize: fontSize.sm[0],
                  lineHeight: fontSize.sm[1],
                  color: ink[900],
                }}
              >
                {intro.note}
              </TruncatedText>
            </View>
          </Animated.View>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(250).delay(index * 80)}>
      <Pressable
        {...pressHandlers}
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Animated.View style={[animatedStyle, elevation.sm]}>
          <LinearGradient
            colors={gradients.sunset}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: radii.xl,
              padding: spacing[6],
              overflow: "hidden",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[4] }}>
              <View
                style={{
                  borderRadius: radii.pill,
                  borderWidth: 2,
                  borderColor: plum[300],
                  padding: 2,
                }}
              >
                <Avatar name={intro.matchAvatarName} size={40} imageUri={intro.matchAvatarUri} />
              </View>

              <Text
                style={{
                  flexShrink: 1,
                  fontFamily: fonts.monoMedium,
                  fontSize: fontSize.xs[0],
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: "#FFFFFF",
                }}
              >
                Intro from {intro.matchmakerName}
              </Text>
            </View>

            <Text
              style={{
                marginTop: spacing[4],
                fontFamily: fonts.display,
                fontSize: fontSize.xl[0],
                lineHeight: fontSize.xl[1],
                color: "#FFFFFF",
              }}
            >
              {intro.note}
            </Text>
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export default IntroPreviewCard;
