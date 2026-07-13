import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SentIntroStats } from "../../components/intros/SentIntroStats";
import { SentIntroList } from "../../components/intros/SentIntroList";
import { MatchmakerLeaderboardCard } from "../../components/intros/MatchmakerLeaderboardCard";
import type { SentIntro } from "../../components/intros/mockSentIntros";
import { useIntrosStore } from "../../store/intros";
import { MOCK_LEADERBOARD } from "../../components/intros/mockLeaderboard";
import { TAB_BAR_CLEARANCE } from "../../components/home/TabBar";
import { IntrosGlyph } from "../../components/ui/TabGlyphs";
import { coral, ink, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

function handleMakeIntroPress() {
  // TODO: router.push('/matchmaker/select')
}

function handleNudge(intro: SentIntro) {
  // TODO: send a nudge notification to the pending recipient(s) via Supabase.
}

function handleWithdraw(intro: SentIntro) {
  // TODO: update introductions.status and remove from the sent list via Supabase.
}

export default function IntrosScreen() {
  const insets = useSafeAreaInsets();
  const sentIntros = useIntrosStore((s) => s.sentIntros);
  const hasSentIntros = sentIntros.length > 0;

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

        {hasSentIntros && <MatchmakerLeaderboardCard entries={MOCK_LEADERBOARD} />}

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
