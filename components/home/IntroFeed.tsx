import { Text, View } from "react-native";
import { EmptyIntrosState } from "./EmptyIntrosState";
import { IntroPreviewCard } from "../intro/IntroPreviewCard";
import type { IntroPreview } from "../intro/mockIntros";
import { coral, ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

interface IntroFeedProps {
  intros: IntroPreview[];
  onInvitePress?: () => void;
}

export function IntroFeed({ intros, onInvitePress }: IntroFeedProps) {
  const [hero, ...rest] = intros;
  const nextUp = rest.slice(0, 2);

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

      {!hero ? (
        <EmptyIntrosState onInvitePress={onInvitePress} />
      ) : (
        <View style={{ gap: spacing[4] }}>
          <IntroPreviewCard intro={hero} index={0} variant="hero" />

          {nextUp.length > 0 && (
            <View style={{ gap: spacing[2] }}>
              <Text
                style={{
                  fontFamily: fonts.monoMedium,
                  fontSize: fontSize["2xs"][0],
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: ink[500],
                }}
              >
                Next up
              </Text>
              {nextUp.map((intro, i) => (
                <IntroPreviewCard key={intro.id} intro={intro} index={i + 1} variant="stack" />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default IntroFeed;
