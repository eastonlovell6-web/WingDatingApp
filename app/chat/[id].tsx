import { useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { Avatar } from "../../components/ui/Avatar";
import { MessageBubble } from "../../components/chat/MessageBubble";
import { ChatInput } from "../../components/chat/ChatInput";
import { MOCK_MESSAGES } from "../../components/chat/mockMessages";
import type { Message } from "../../components/chat/mockMessages";
import { MOCK_CHATS } from "../../components/chats/mockChats";
import { sendMessage } from "../../lib/chat";
import { ink, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 8 12l7 7" stroke={ink[900]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const chat = MOCK_CHATS.find((c) => c.id === id);
  const [messages, setMessages] = useState<Message[]>(() => MOCK_MESSAGES[id ?? ""] ?? []);

  function handleSend(content: string) {
    const message: Message = {
      id: `local-${Date.now()}`,
      chatId: id ?? "",
      senderId: "me",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, message]);
    if (id) {
      sendMessage(id, content).catch((err) => console.warn("failed to send message", err));
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: surface.cream }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing[4],
          paddingTop: insets.top + spacing[2],
          paddingBottom: spacing[4],
          paddingHorizontal: spacing[4],
          backgroundColor: surface.paper,
          shadowColor: shadowTint,
          shadowOpacity: 1,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        <Pressable onPress={() => router.canGoBack() && router.back()} hitSlop={8}>
          <BackIcon />
        </Pressable>
        <Avatar name={chat?.matchName ?? "?"} imageUri={chat?.matchAvatarUri} size={40} />
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.lg[0], color: ink[900] }}>
          {chat?.matchName.split(" ")[0] ?? "Chat"}
        </Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={{ padding: spacing[4], flexGrow: 1, justifyContent: "flex-end" }}
      />

      <ChatInput onSend={handleSend} bottomInset={insets.bottom} />
    </KeyboardAvoidingView>
  );
}
