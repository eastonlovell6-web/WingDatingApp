import { View } from "react-native";
import { EmptyChatsState } from "./EmptyChatsState";
import { ChatRow } from "./ChatRow";
import type { ChatPreview } from "./mockChats";
import { spacing } from "../../constants/spacing";

interface ChatListProps {
  chats: ChatPreview[];
}

export function ChatList({ chats }: ChatListProps) {
  if (chats.length === 0) {
    return <EmptyChatsState />;
  }

  return (
    <View style={{ gap: spacing[4] }}>
      {chats.map((chat) => (
        <ChatRow key={chat.id} chat={chat} />
      ))}
    </View>
  );
}

export default ChatList;
