import { Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { coral, ink, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import type { MatchmakerBadge } from "./mockProfile";

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: surface.paper,
        borderRadius: radii.md,
        padding: spacing[4],
        gap: 2,
        shadowColor: shadowTint,
        shadowOpacity: 1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 1,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: fontSize["3xl"][0],
          lineHeight: fontSize["3xl"][1],
          color: ink[900],
        }}
      >
        {value}
      </Text>
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

function EmptyMatchmakerNudge({ onMakeIntroPress }: { onMakeIntroPress?: () => void }) {
  return (
    <View
      style={{
        backgroundColor: surface.paper,
        borderRadius: radii.lg,
        padding: spacing[6],
        gap: spacing[4],
        alignItems: "center",
        shadowColor: shadowTint,
        shadowOpacity: 1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: fontSize.xl[0],
          lineHeight: fontSize.xl[1],
          color: ink[900],
          textAlign: "center",
        }}
      >
        You haven&apos;t played matchmaker yet
      </Text>
      <Text
        style={{
          fontFamily: fonts.body,
          fontSize: fontSize.sm[0],
          lineHeight: fontSize.sm[1],
          color: ink[500],
          textAlign: "center",
        }}
      >
        Introduce two friends who&apos;d click — it takes under a minute.
      </Text>
      <Button
        title="Make your first intro"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          // TODO: router.push('/matchmaker/select') once that screen exists.
          onMakeIntroPress?.();
        }}
        style={{ marginTop: spacing[2] }}
      />
    </View>
  );
}

interface MatchmakerPanelProps {
  score: number;
  percentileLabel: string;
  introsSent: number;
  introsAccepted: number;
  hasSentIntros: boolean;
  badges: MatchmakerBadge[];
  onMakeIntroPress?: () => void;
}

export function MatchmakerPanel({
  score,
  percentileLabel,
  introsSent,
  introsAccepted,
  hasSentIntros,
  badges,
  onMakeIntroPress,
}: MatchmakerPanelProps) {
  return (
    <View style={{ gap: spacing[6] }}>
      <View
        style={{
          backgroundColor: surface.paper,
          borderRadius: radii.xl,
          padding: spacing[6],
          gap: spacing[2],
          alignItems: "center",
          shadowColor: shadowTint,
          shadowOpacity: 1,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        }}
      >
        <Text
          style={{
            fontFamily: fonts.monoMedium,
            fontSize: fontSize.xs[0],
            letterSpacing: 1,
            textTransform: "uppercase",
            color: coral[500],
          }}
        >
          Matchmaker Score
        </Text>
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: fontSize["6xl"][0],
            lineHeight: fontSize["6xl"][1],
            color: coral[500],
          }}
        >
          {score}
        </Text>
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.sm[0],
            lineHeight: fontSize.sm[1],
            color: ink[500],
            textAlign: "center",
          }}
        >
          {percentileLabel}
        </Text>
      </View>

      {hasSentIntros ? (
        <View style={{ flexDirection: "row", gap: spacing[4] }}>
          <StatTile value={introsSent} label="Intros sent" />
          <StatTile value={introsAccepted} label="Accepted" />
        </View>
      ) : (
        <EmptyMatchmakerNudge onMakeIntroPress={onMakeIntroPress} />
      )}

      {badges.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
          {badges.map((badge) => (
            <Badge key={badge.id} label={badge.label} tone={badge.tone} variant={badge.variant} />
          ))}
        </View>
      )}
    </View>
  );
}

export default MatchmakerPanel;
