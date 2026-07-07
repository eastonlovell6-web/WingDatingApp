import { useState } from "react";
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
import { Badge } from "../ui/Badge";
import { gradients } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import type { IntroPreview } from "./mockIntros";

interface IntroPreviewCardProps {
  intro: IntroPreview;
  index: number;
  onPress?: () => void;
}

const spring = { mass: 0.4, damping: 12, stiffness: 220 };

export function IntroPreviewCard({ intro, index, onPress }: IntroPreviewCardProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: router.push(`/intro/${intro.id}`)
    onPress?.();
  }

  return (
    <Animated.View entering={FadeInDown.duration(220).delay(index * 60)}>
      <Pressable
        onPressIn={() => (scale.value = withSpring(0.98, spring))}
        onPressOut={() => (scale.value = withSpring(1, spring))}
        onPress={handlePress}
      >
        <Animated.View style={animatedStyle}>
          <LinearGradient
            colors={gradients.sunset}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: radii.xl,
              padding: spacing[6],
              gap: spacing[4],
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.monoMedium,
                  fontSize: fontSize.xs[0],
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: "#FFFFFF",
                }}
              >
                Intro from {intro.matchmakerName}
              </Text>
              {intro.isNew && <Badge label="New intro" tone="coral" variant="solid" />}
            </View>

            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: fontSize.xl[0],
                lineHeight: fontSize.xl[1],
                color: "#FFFFFF",
              }}
              numberOfLines={2}
            >
              {intro.note}
            </Text>

            <Avatar name={intro.matchAvatarName} size={32} />
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export default IntroPreviewCard;
