import { Alert, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { gradients, ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { elevation } from "../../constants/elevation";
import type { Prompt } from "../../lib/prompts";

interface PromptCardProps {
  prompt: Prompt;
  introducibleCount: number;
}

// Same "coming soon" convention as PrivacyPanel's onVisibilityPress in
// app/(tabs)/profile.tsx — no real Friend Visibility Settings screen yet.
function openFriendVisibilitySettings() {
  Alert.alert("Friend visibility settings", "This screen isn't built yet — hang tight.");
}

export function PromptCard({ prompt, introducibleCount }: PromptCardProps) {
  const locked = introducibleCount < 2;

  function handlePress() {
    if (locked) {
      openFriendVisibilitySettings();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/matchmaker/prompt-friends" as never);
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={locked ? "Friend visibility settings" : "Today's prompt"}
    >
      {({ pressed }) => (
        <View style={[elevation.sm, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
          <LinearGradient
            colors={locked ? [ink[300], ink[200]] : gradients.sunset}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: radii.xl,
              padding: spacing[8],
              overflow: "hidden",
            }}
          >
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: fontSize.xs[0],
                letterSpacing: 1,
                textTransform: "uppercase",
                color: locked ? ink[700] : "#FFFFFF",
              }}
            >
              {locked ? "Prompt locked" : "Today's prompt"}
            </Text>
            <Text
              style={{
                marginTop: spacing[4],
                fontFamily: fonts.display,
                fontSize: fontSize["2xl"][0],
                lineHeight: fontSize["2xl"][1],
                color: locked ? ink[900] : "#FFFFFF",
              }}
            >
              {locked
                ? "Add a friend who'll let you introduce them to unlock today's prompt."
                : prompt.text}
            </Text>
          </LinearGradient>
        </View>
      )}
    </Pressable>
  );
}

export default PromptCard;
