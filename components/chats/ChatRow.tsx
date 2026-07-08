import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { coral, ink, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { formatRelativeTime, truncateAtWord } from "../../lib/format";
import type { ChatPreview } from "./mockChats";

interface ChatRowProps {
  chat: ChatPreview;
}

const spring = { mass: 0.4, damping: 12, stiffness: 220 };
const PREVIEW_MAX_LENGTH = 52;

export function ChatRow({ chat }: ChatRowProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const firstName = chat.matchName.split(" ")[0];

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/chat/${chat.id}` as never);
  }

  return (
    <Pressable
      onPressIn={() => (scale.value = withSpring(0.98, spring))}
      onPressOut={() => (scale.value = withSpring(1, spring))}
      onPress={handlePress}
    >
      <Animated.View
        style={[
          {
            flexDirection: "row",
            gap: spacing[4],
            backgroundColor: surface.paper,
            borderRadius: radii.md,
            padding: spacing[4],
            shadowColor: shadowTint,
            shadowOpacity: 1,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
          },
          animatedStyle,
        ]}
      >
        <Avatar name={chat.matchName} imageUri={chat.matchAvatarUri} size={56} />

        <View style={{ flex: 1, gap: spacing[2] }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[2] }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
              <Text
                style={{
                  fontFamily: chat.unread ? fonts.bodyBold : fonts.bodyMedium,
                  fontSize: fontSize.base[0],
                  color: ink[900],
                }}
                numberOfLines={1}
              >
                {firstName}
              </Text>
              {chat.unread && (
                <View style={{ width: 8, height: 8, borderRadius: radii.pill, backgroundColor: coral[500] }} />
              )}
            </View>
            <Text style={{ fontFamily: fonts.body, fontSize: fontSize.sm[0], color: ink[500] }}>
              {formatRelativeTime(chat.lastMessageAt)}
            </Text>
          </View>

          <Text
            style={{ fontFamily: fonts.body, fontSize: fontSize.sm[0], color: ink[500] }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {truncateAtWord(chat.lastMessage, PREVIEW_MAX_LENGTH)}
          </Text>

          <Badge label={`Introduced by ${chat.introducedByName}`} tone="plum" variant="solid" />
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default ChatRow;
