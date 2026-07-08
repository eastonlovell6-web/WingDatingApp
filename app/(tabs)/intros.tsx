import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SentIntroStats } from "../../components/intros/SentIntroStats";
import { SentIntroList } from "../../components/intros/SentIntroList";
import { MOCK_SENT_INTROS } from "../../components/intros/mockSentIntros";
import { TAB_BAR_CLEARANCE } from "../../components/home/TabBar";
import { IntrosGlyph } from "../../components/ui/TabGlyphs";
import { coral, ink, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

function handleMakeIntroPress() {
  // TODO: router.push('/matchmaker/select')
}

export default function IntrosScreen() {
  const insets = useSafeAreaInsets();
  const hasSentIntros = MOCK_SENT_INTROS.length > 0;

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

        <SentIntroStats intros={MOCK_SENT_INTROS} />

        <SentIntroList intros={MOCK_SENT_INTROS} onMakeIntroPress={handleMakeIntroPress} />

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
