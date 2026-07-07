import { Text, View } from "react-native";
import { EmptyIntrosState } from "./EmptyIntrosState";
import { IntroPreviewCard } from "../intro/IntroPreviewCard";
import type { IntroPreview } from "../intro/mockIntros";
import { coral } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

interface IntroFeedProps {
  intros: IntroPreview[];
  onInvitePress?: () => void;
}

export function IntroFeed({ intros, onInvitePress }: IntroFeedProps) {
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
        Your intros
      </Text>

      {intros.length === 0 ? (
        <EmptyIntrosState onInvitePress={onInvitePress} />
      ) : (
        <View style={{ gap: spacing[4] }}>
          {intros.slice(0, 3).map((intro, index) => (
            <IntroPreviewCard key={intro.id} intro={intro} index={index} />
          ))}
        </View>
      )}
    </View>
  );
}

export default IntroFeed;
