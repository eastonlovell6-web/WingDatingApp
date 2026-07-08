import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatList } from "../../components/chats/ChatList";
import { MOCK_CHATS } from "../../components/chats/mockChats";
import { TAB_BAR_CLEARANCE } from "../../components/home/TabBar";
import { ChatsGlyph } from "../../components/ui/TabGlyphs";
import { ink, plum, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const hasChats = MOCK_CHATS.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing[4],
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE + spacing[4],
          paddingHorizontal: spacing[6],
          gap: spacing[6],
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ChatsGlyph size={20} color={plum[600]} />
          <Text
            style={{
              fontFamily: fonts.displaySemibold,
              fontSize: fontSize.xl[0],
              lineHeight: fontSize.xl[1],
              color: ink[900],
            }}
          >
            Chats
          </Text>
        </View>

        <ChatList chats={MOCK_CHATS} />

        {hasChats && (
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: fontSize.sm[0],
              lineHeight: fontSize.sm[1],
              color: ink[500],
              textAlign: "center",
            }}
          >
            Everyone on this list said yes twice — once to the idea, once to the person.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
