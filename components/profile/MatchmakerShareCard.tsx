import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { gradients } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { WingMark } from "../ui/WingMark";
import type { MatchmakerBadge } from "./mockProfile";

export const SHARE_CARD_WIDTH = 270;
export const SHARE_CARD_HEIGHT = 480; // 9:16 — Instagram Story / iMessage ratio

interface MatchmakerShareCardProps {
  score: number;
  rankTier: string;
  rankLevel: number;
  percentileLabel: string;
  badges: MatchmakerBadge[];
}

export function MatchmakerShareCard({
  score,
  rankTier,
  rankLevel,
  percentileLabel,
  badges,
}: MatchmakerShareCardProps) {
  return (
    <LinearGradient
      colors={gradients.dusk}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: SHARE_CARD_WIDTH,
        height: SHARE_CARD_HEIGHT,
        borderRadius: radii.xl,
        padding: spacing[6],
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View style={{ alignItems: "center", gap: spacing[2] }}>
        <WingMark size={28} color="#FFFFFF" />
        <Text
          style={{
            fontFamily: fonts.monoMedium,
            fontSize: fontSize["2xs"][0],
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "#FFFFFF",
          }}
        >
          Matchmaker Score
        </Text>
      </View>

      <View style={{ alignItems: "center", gap: spacing[2] }}>
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 72,
            lineHeight: 76,
            color: "#FFFFFF",
          }}
        >
          {score}
        </Text>
        <Text
          style={{
            fontFamily: fonts.bodyMedium,
            fontSize: fontSize.base[0],
            color: "rgba(255,255,255,0.8)",
          }}
        >
          {`${rankTier} · Lvl ${rankLevel}`}
        </Text>
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.sm[0],
            lineHeight: fontSize.sm[1],
            color: "rgba(255,255,255,0.9)",
            textAlign: "center",
            marginTop: spacing[2],
          }}
        >
          {percentileLabel}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: spacing[2],
        }}
      >
        {badges.map((badge) => (
          <View
            key={badge.id}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: radii.pill,
              backgroundColor: "rgba(255,255,255,0.18)",
            }}
          >
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: fontSize["2xs"][0],
                letterSpacing: 0.5,
                textTransform: "uppercase",
                color: "#FFFFFF",
              }}
            >
              {badge.label}
            </Text>
          </View>
        ))}
      </View>

      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: fontSize["2xs"][0],
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.5)",
        }}
      >
        wing
      </Text>
    </LinearGradient>
  );
}

export default MatchmakerShareCard;
