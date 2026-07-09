import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { gradients } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { elevation } from "../../constants/elevation";

interface IntroNoteCardProps {
  note: string;
  matchmakerName?: string;
  /** Overrides the default "Intro from {matchmakerName}" eyebrow text —
   * e.g. the Intros-sent screen shows this note back to the matchmaker
   * themselves, so "Intro from" doesn't apply. */
  eyebrow?: string;
}

/**
 * The full, uncut intro note — the emotional center of the Intro Detail
 * screen. No numberOfLines anywhere here: this note never truncates.
 */
export function IntroNoteCard({ matchmakerName, note, eyebrow }: IntroNoteCardProps) {
  return (
    <View style={elevation.sm}>
      <LinearGradient
        colors={gradients.sunset}
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
            color: "#FFFFFF",
          }}
        >
          {eyebrow ?? `Intro from ${matchmakerName}`}
        </Text>
        <Text
          style={{
            marginTop: spacing[4],
            fontFamily: fonts.display,
            fontSize: fontSize["2xl"][0],
            lineHeight: fontSize["2xl"][1],
            color: "#FFFFFF",
          }}
        >
          {note}
        </Text>
      </LinearGradient>
    </View>
  );
}

export default IntroNoteCard;
