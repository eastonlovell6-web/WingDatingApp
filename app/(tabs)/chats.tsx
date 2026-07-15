import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChatList } from "../../components/chats/ChatList";
import { TAB_BAR_CLEARANCE } from "../../components/home/TabBar";
import { ChatsGlyph } from "../../components/ui/TabGlyphs";
import { useAuthStore } from "../../store/auth";
import { getChats, subscribeToInbox } from "../../lib/chat";
import { ink, plum, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  const { data: allChats = [] } = useQuery({
    queryKey: ["chats", userId],
    queryFn: () => getChats(userId!),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;
    return subscribeToInbox(() => {
      queryClient.invalidateQueries({ queryKey: ["chats", userId] });
    });
  }, [userId, queryClient]);

  const chats = allChats.filter((chat) => !removedIds.has(chat.id));
  const hasChats = chats.length > 0;

  function handleRemoveChat(id: string) {
    setRemovedIds((prev) => new Set(prev).add(id));
  }

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

        <ChatList chats={chats} onRemoveChat={handleRemoveChat} />

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
