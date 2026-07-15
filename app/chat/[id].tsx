import { useEffect } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Svg, { Path } from "react-native-svg";
import { Avatar } from "../../components/ui/Avatar";
import { MessageBubble } from "../../components/chat/MessageBubble";
import { ChatInput } from "../../components/chat/ChatInput";
import type { Message } from "../../components/chat/mockMessages";
import { useAuthStore } from "../../store/auth";
import { getChatHeader, getMessages, sendMessage, setLastViewed, subscribeToMessages } from "../../lib/chat";
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
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const { data: header } = useQuery({
    queryKey: ["chatHeader", id],
    queryFn: () => getChatHeader(id!, userId!),
    enabled: !!id && !!userId,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", id],
    queryFn: () => getMessages(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (!id) return;
    setLastViewed(id).catch((err) => console.warn("failed to mark chat viewed", err));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribeToMessages(id, (message) => {
      queryClient.setQueryData<Message[]>(["messages", id], (prev = []) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message]
      );
      setLastViewed(id).catch((err) => console.warn("failed to mark chat viewed", err));
    });
  }, [id, queryClient]);

  function handleSend(content: string) {
    if (!id || !userId) return;
    const tempId = `local-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      chatId: id,
      senderId: userId,
      content,
      createdAt: new Date().toISOString(),
    };
    queryClient.setQueryData<Message[]>(["messages", id], (prev = []) => [...prev, optimisticMessage]);

    sendMessage(id, content)
      .then(({ messageId, createdAt }) => {
        queryClient.setQueryData<Message[]>(["messages", id], (prev = []) => {
          const withoutTemp = prev.filter((m) => m.id !== tempId);
          if (withoutTemp.some((m) => m.id === messageId)) return withoutTemp;
          return [...withoutTemp, { ...optimisticMessage, id: messageId, createdAt }];
        });
      })
      .catch((err) => console.warn("failed to send message", err));
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
        <Avatar name={header?.matchName ?? "?"} imageUri={header?.matchAvatarUri} size={40} />
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.lg[0], color: ink[900] }}>
          {header?.matchName?.split(" ")[0] ?? "Chat"}
        </Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MessageBubble message={item} isMine={item.senderId === userId} />}
        contentContainerStyle={{ padding: spacing[4], flexGrow: 1, justifyContent: "flex-end" }}
      />

      <ChatInput onSend={handleSend} bottomInset={insets.bottom} />
    </KeyboardAvoidingView>
  );
}
