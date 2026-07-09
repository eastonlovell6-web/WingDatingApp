import { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { ink, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import type { ProfilePrompt } from "../profile/mockProfile";

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <Svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
    >
      <Path d="M6 9l6 6 6-6" stroke={ink[500]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

interface AboutSectionProps {
  name: string;
  photos: string[];
  prompts: ProfilePrompt[];
}

/**
 * Collapsed-by-default "About [Name]" panel — same depth of info either
 * person would see about the other: extra photos + bio prompts.
 */
export function AboutSection({ name, photos, prompts }: AboutSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const firstName = name.split(" ")[0];

  function toggle() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded((prev) => !prev);
  }

  return (
    <View style={{ gap: spacing[4] }}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? "Collapse" : "Expand"} about ${firstName}`}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
      >
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.lg[0], color: ink[900] }}>
          About {firstName}
        </Text>
        <ChevronIcon expanded={expanded} />
      </Pressable>

      {expanded && (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={{ gap: spacing[4] }}>
          {photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2] }}>
              {photos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={{ width: 140, aspectRatio: 4 / 5, borderRadius: radii.lg }} />
              ))}
            </ScrollView>
          )}

          {prompts.map((prompt, i) => (
            <View
              key={i}
              style={{
                backgroundColor: surface.paper,
                borderRadius: radii.lg,
                padding: spacing[4],
                gap: spacing[2],
                shadowColor: shadowTint,
                shadowOpacity: 1,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 2,
              }}
            >
              <Text
                style={{ fontFamily: fonts.body, fontSize: fontSize.sm[0], lineHeight: fontSize.sm[1], color: ink[500] }}
              >
                {prompt.question}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: fontSize.xl[0],
                  lineHeight: fontSize.xl[1],
                  letterSpacing: -0.2,
                  color: ink[900],
                }}
              >
                {prompt.answer}
              </Text>
            </View>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

export default AboutSection;
