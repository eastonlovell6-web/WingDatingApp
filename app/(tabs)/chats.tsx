import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatList } from "../../components/chats/ChatList";
import { MOCK_CHATS } from "../../components/chats/mockChats";
import { TAB_BAR_CLEARANCE } from "../../components/home/TabBar";
import { ink, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();

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

        <ChatList chats={MOCK_CHATS} />
      </ScrollView>
    </View>
  );
}
