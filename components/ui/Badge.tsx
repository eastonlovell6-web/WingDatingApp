import { Text, View } from "react-native";
import { butter, coral, mint, plum } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { fontSize } from "../../constants/typography";
import { radii } from "../../constants/spacing";

type Tone = "coral" | "mint" | "butter" | "plum";
type Variant = "solid" | "outline";

const tones: Record<Tone, { bg: string; border: string; text: string }> = {
  coral: { bg: coral[500], border: coral[500], text: "#FFFFFF" },
  mint: { bg: mint[100], border: mint[500], text: mint[700] },
  butter: { bg: butter[100], border: butter[500], text: butter[700] },
  plum: { bg: plum[100], border: plum[500], text: plum[600] },
};

interface BadgeProps {
  label: string;
  variant?: Variant;
  tone?: Tone;
  /** Override the label color — e.g. PENDING is butter outline + dark text, not butter text. */
  textColor?: string;
}

export function Badge({ label, variant = "solid", tone = "coral", textColor }: BadgeProps) {
  const t = tones[tone];
  const isSolid = variant === "solid";

  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radii.pill,
        backgroundColor: isSolid ? t.bg : "transparent",
        borderWidth: isSolid ? 0 : 1.5,
        borderColor: t.border,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: fontSize["2xs"][0],
          letterSpacing: 1,
          textTransform: "uppercase",
          color: textColor ?? (isSolid ? t.text : t.border),
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default Badge;
