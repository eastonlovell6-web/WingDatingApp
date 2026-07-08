import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Avatar } from "../ui/Avatar";
import { TruncatedText } from "../ui/TruncatedText";
import { coral, ink, plum, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { formatRelativeTime } from "../../lib/format";
import type { ChatPreview } from "./mockChats";

interface ChatRowProps {
  chat: ChatPreview;
  index: number;
}

const spring = { mass: 0.4, damping: 12, stiffness: 220 };

// Quick, tight succession with a small rise — deliberately faster and
// shallower than the Intros list's slower FadeInDown so the two tabs don't
// feel like copies of each other.
const ROW_STAGGER_MS = 45;
const ROW_ENTER_DURATION_MS = 160;

export function ChatRow({ chat, index }: ChatRowProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const firstName = chat.matchName.split(" ")[0];
  const rowDelay = index * ROW_STAGGER_MS;

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
      {/* Entrance (`entering`) lives on this outer node and the press-scale
          (`useAnimatedStyle`) on the inner one, matching the pattern already
          used for Intros. Note: `.withInitialValues()` on an entering
          animation forces Reanimated's web layer into a permanent
          `position: absolute`, collapsing this row's height in its
          flex-column parent — stick to the built-in offset here. */}
      <Animated.View entering={FadeInDown.duration(ROW_ENTER_DURATION_MS).delay(rowDelay)}>
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
                  <Animated.View
                    entering={FadeIn.duration(220).delay(rowDelay + 260)}
                    style={{ width: 8, height: 8, borderRadius: radii.pill, backgroundColor: coral[500] }}
                  />
                )}
              </View>
              <Text style={{ fontFamily: fonts.body, fontSize: fontSize.sm[0], color: ink[500] }}>
                {formatRelativeTime(chat.lastMessageAt)}
              </Text>
            </View>

            <TruncatedText
              style={{ fontFamily: fonts.body, fontSize: fontSize.sm[0], color: ink[500] }}
              numberOfLines={1}
            >
              {chat.lastMessage}
            </TruncatedText>

            <Animated.View entering={SlideInLeft.duration(220).delay(rowDelay + 200)}>
              <Text
                style={{
                  fontFamily: fonts.monoMedium,
                  fontSize: fontSize["2xs"][0],
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: plum[500],
                }}
                numberOfLines={1}
              >
                ↳ Introduced by {chat.introducedByName}
              </Text>
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export default ChatRow;
