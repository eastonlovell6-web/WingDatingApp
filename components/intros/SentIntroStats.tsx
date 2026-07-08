import { Text, View } from "react-native";
import { ink } from "../../constants/colors";
import { fonts, fontSize, textStyles } from "../../constants/typography";
import { spacing } from "../../constants/spacing";
import type { SentIntro } from "./mockSentIntros";

interface SentIntroStatsProps {
  intros: SentIntro[];
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={textStyles.stat}>{value}</Text>
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: fontSize["2xs"][0],
          letterSpacing: 1,
          textTransform: "uppercase",
          color: ink[500],
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function SentIntroStats({ intros }: SentIntroStatsProps) {
  const sentCount = intros.length;
  const matchedCount = intros.filter((intro) => intro.status === "matched").length;

  return (
    <View style={{ flexDirection: "row", gap: spacing[8] }}>
      <StatTile value={sentCount} label="Intros sent" />
      <StatTile value={matchedCount} label="Matched" />
    </View>
  );
}

export default SentIntroStats;
