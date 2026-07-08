import { Text, View } from "react-native";
import { coral, ink, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import type { Message } from "./mockMessages";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isMine = message.senderId === "me";

  return (
    <View style={{ alignItems: isMine ? "flex-end" : "flex-start", marginBottom: spacing[2] }}>
      <View
        style={{
          maxWidth: "78%",
          backgroundColor: isMine ? coral[500] : surface.paper,
          borderRadius: radii.lg,
          borderBottomRightRadius: isMine ? radii.sm : radii.lg,
          borderBottomLeftRadius: isMine ? radii.lg : radii.sm,
          paddingHorizontal: spacing[4],
          paddingVertical: 10,
          shadowColor: shadowTint,
          shadowOpacity: isMine ? 0 : 1,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: isMine ? 0 : 2,
        }}
      >
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.base[0],
            lineHeight: fontSize.base[1],
            color: isMine ? "#FFFFFF" : ink[900],
          }}
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
}

export default MessageBubble;
