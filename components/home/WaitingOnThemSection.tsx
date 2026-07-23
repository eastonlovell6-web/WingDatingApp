// components/home/WaitingOnThemSection.tsx
import { Text, View } from "react-native";
import { WaitingIntroCard } from "../intro/WaitingIntroCard";
import type { WaitingIntro } from "../intro/mockIntros";
import { coral } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

interface WaitingOnThemSectionProps {
  waiting: WaitingIntro[];
}

export function WaitingOnThemSection({ waiting }: WaitingOnThemSectionProps) {
  if (waiting.length === 0) return null;

  return (
    <View style={{ gap: spacing[4] }}>
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: fontSize.xs[0],
          letterSpacing: 1,
          textTransform: "uppercase",
          color: coral[500],
        }}
      >
        Waiting on them
      </Text>
      <View style={{ gap: spacing[2] }}>
        {waiting.map((intro) => (
          <WaitingIntroCard key={intro.id} intro={intro} />
        ))}
      </View>
    </View>
  );
}

export default WaitingOnThemSection;
