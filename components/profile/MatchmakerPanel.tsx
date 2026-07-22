import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { MatchmakerScoreRing } from "./MatchmakerScoreRing";
import { RankProgressBar } from "./RankProgressBar";
import { ShareScoreModal } from "./ShareScoreModal";
import { coral, ink, plum, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { formatRelativeTime } from "../../lib/format";
import type { SentIntro } from "../intros/mockSentIntros";
import type { MatchmakerBadge, MatchmakerRankProgress } from "./mockProfile";

function ShareIcon({ size = 20, color = ink[500] }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v12" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path
        d="M7 8l5-5 5 5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PendingIntroBanner({ intro }: { intro: SentIntro }) {
  return (
    <View
      style={{
        backgroundColor: plum[100],
        borderRadius: radii.lg,
        padding: spacing[4],
        gap: 2,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.bodyMedium,
          fontSize: fontSize.sm[0],
          lineHeight: fontSize.sm[1],
          color: plum[600],
        }}
      >
        {`Your intro for ${intro.personAName} & ${intro.personBName} is still awaiting a reply`}
      </Text>
      <Text style={{ fontFamily: fonts.body, fontSize: fontSize.xs[0], color: ink[500] }}>
        {`Sent ${formatRelativeTime(intro.sentAt)}`}
      </Text>
    </View>
  );
}

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
  rankProgress: MatchmakerRankProgress;
  nextMilestoneCopy: string;
  pendingIntro?: SentIntro;
  onMakeIntroPress?: () => void;
}

export function MatchmakerPanel({
  score,
  percentileLabel,
  introsSent,
  introsAccepted,
  hasSentIntros,
  badges,
  rankProgress,
  nextMilestoneCopy,
  pendingIntro,
  onMakeIntroPress,
}: MatchmakerPanelProps) {
  const [shareModalVisible, setShareModalVisible] = useState(false);

  function handleSharePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShareModalVisible(true);
  }

  return (
    <View style={{ gap: spacing[6] }}>
      {pendingIntro && <PendingIntroBanner intro={pendingIntro} />}

      <View
        style={{
          backgroundColor: surface.paper,
          borderRadius: radii.xl,
          padding: spacing[6],
          alignItems: "stretch",
          shadowColor: shadowTint,
          shadowOpacity: 1,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        }}
      >
        <View style={{ position: "relative" }}>
          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: fontSize.xs[0],
              letterSpacing: 1,
              textTransform: "uppercase",
              color: coral[500],
              textAlign: "center",
            }}
          >
            Matchmaker Score
          </Text>
          <Pressable
            onPress={handleSharePress}
            accessibilityRole="button"
            accessibilityLabel="Share your matchmaker score"
            hitSlop={8}
            style={{ position: "absolute", top: -4, right: 0 }}
          >
            <ShareIcon />
          </Pressable>
        </View>

        <View style={{ marginTop: spacing[4] }}>
          <MatchmakerScoreRing
            score={score}
            rankTier={rankProgress.tier}
            rankLevel={rankProgress.level}
          />
        </View>

        <Text
          style={{
            fontFamily: fonts.bodyMedium,
            fontSize: fontSize.sm[0],
            lineHeight: fontSize.sm[1],
            color: coral[700],
            textAlign: "center",
            marginTop: spacing[8],
          }}
        >
          {nextMilestoneCopy}
        </Text>

        <View style={{ marginTop: spacing[2] }}>
          <RankProgressBar
            xpCurrent={rankProgress.xpCurrent}
            xpForNextLevel={rankProgress.xpForNextLevel}
            streakWeeks={rankProgress.streakWeeks}
            streakAtRisk={rankProgress.streakAtRisk}
            streakResetsInDays={rankProgress.streakResetsInDays}
          />
        </View>

        {/* TODO(phase 2): replace with bell-curve distribution graphic */}
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.sm[0],
            lineHeight: fontSize.sm[1],
            color: ink[500],
            textAlign: "center",
            marginTop: spacing[4],
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

      <ShareScoreModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        score={score}
        rankTier={rankProgress.tier}
        rankLevel={rankProgress.level}
        percentileLabel={percentileLabel}
        badges={badges}
      />
    </View>
  );
}

export default MatchmakerPanel;
