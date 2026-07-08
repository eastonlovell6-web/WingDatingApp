import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SentIntroStats } from "../../components/intros/SentIntroStats";
import { SentIntroList } from "../../components/intros/SentIntroList";
import { MOCK_SENT_INTROS } from "../../components/intros/mockSentIntros";
import { TAB_BAR_CLEARANCE } from "../../components/home/TabBar";
import { ink, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

function handleMakeIntroPress() {
  // TODO: router.push('/matchmaker/select')
}

export default function IntrosScreen() {
  const insets = useSafeAreaInsets();

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

        <SentIntroStats intros={MOCK_SENT_INTROS} />

        <SentIntroList intros={MOCK_SENT_INTROS} onMakeIntroPress={handleMakeIntroPress} />
      </ScrollView>
    </View>
  );
}
