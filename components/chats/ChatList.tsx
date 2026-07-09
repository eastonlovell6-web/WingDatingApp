import { useRef } from "react";
import { View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import Animated, { FadeOut, LinearTransition } from "react-native-reanimated";
import { EmptyChatsState } from "./EmptyChatsState";
import { SwipeableChatRow } from "./SwipeableChatRow";
import type { ChatPreview } from "./mockChats";
import { spacing } from "../../constants/spacing";

interface ChatListProps {
  chats: ChatPreview[];
  onRemoveChat: (id: string) => void;
}

export function ChatList({ chats, onRemoveChat }: ChatListProps) {
  const openRowRef = useRef<Swipeable | null>(null);

  if (chats.length === 0) {
    return <EmptyChatsState />;
  }

  return (
    <View style={{ gap: spacing[4] }}>
      {chats.map((chat, index) => (
        <Animated.View
          key={chat.id}
          layout={LinearTransition.duration(220)}
          exiting={FadeOut.duration(180)}
        >
          <SwipeableChatRow chat={chat} index={index} openRowRef={openRowRef} onRemove={onRemoveChat} />
        </Animated.View>
      ))}
    </View>
  );
}

export default ChatList;
