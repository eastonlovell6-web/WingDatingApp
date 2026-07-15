import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SentIntroStats } from "../../components/intros/SentIntroStats";
import { SentIntroList } from "../../components/intros/SentIntroList";
import { MatchmakerLeaderboardCard } from "../../components/intros/MatchmakerLeaderboardCard";
import type { SentIntro } from "../../components/intros/mockSentIntros";
import {
  getMatchmakerLeaderboardStats,
  getSentIntroductions,
  nudgeIntroduction,
  withdrawIntroduction,
} from "../../lib/introductions";
import { useAuthStore } from "../../store/auth";
import type { LeaderboardEntry } from "../../components/intros/mockLeaderboard";
import { TAB_BAR_CLEARANCE } from "../../components/home/TabBar";
import { IntrosGlyph } from "../../components/ui/TabGlyphs";
import { coral, ink, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

export default function IntrosScreen() {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const queryKey = ["sentIntroductions", userId];

  const { data: sentIntros = [] } = useQuery({
    queryKey,
    queryFn: () => getSentIntroductions(userId!),
    enabled: !!userId,
  });
  const hasSentIntros = sentIntros.length > 0;

  const { data: leaderboardStats = [] } = useQuery({
    queryKey: ["matchmakerLeaderboard", userId],
    queryFn: getMatchmakerLeaderboardStats,
    enabled: !!userId && hasSentIntros,
  });
  const leaderboardEntries: LeaderboardEntry[] = leaderboardStats.map((entry) => ({
    id: entry.id,
    name: entry.name,
    avatarUri: entry.avatarUri,
    introsAccepted: entry.introsAccepted,
    introsSent: entry.introsSent,
    isCurrentUser: entry.id === userId,
  }));

  function handleMakeIntroPress() {
    router.push("/matchmaker/select");
  }

  async function handleNudge(intro: SentIntro) {
    try {
      await nudgeIntroduction(intro.id);
    } catch (err) {
      console.warn("Nudge failed", err);
    }
  }

  async function handleWithdraw(intro: SentIntro) {
    try {
      await withdrawIntroduction(intro.id);
      queryClient.invalidateQueries({ queryKey });
    } catch (err) {
      console.warn("Withdraw failed", err);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing[4],
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE + spacing[4],
          paddingHorizontal: spacing[6],
          gap: spacing[8],
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <IntrosGlyph size={20} color={coral[500]} />
          <Text
            style={{
              fontFamily: fonts.displaySemibold,
              fontSize: fontSize.xl[0],
              lineHeight: fontSize.xl[1],
              color: ink[900],
            }}
          >
            Intros you&rsquo;ve sent
          </Text>
        </View>

        <SentIntroStats intros={sentIntros} />

        <SentIntroList
          intros={sentIntros}
          onMakeIntroPress={handleMakeIntroPress}
          onNudge={handleNudge}
          onWithdraw={handleWithdraw}
        />

        {hasSentIntros && <MatchmakerLeaderboardCard entries={leaderboardEntries} />}

        {hasSentIntros && (
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: fontSize.sm[0],
              lineHeight: fontSize.sm[1],
              color: ink[500],
              textAlign: "center",
            }}
          >
            You won&rsquo;t hear if it doesn&rsquo;t land — that&rsquo;s the deal.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
