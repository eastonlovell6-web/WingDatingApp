import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Avatar } from "../ui/Avatar";
import { coral, ink, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";
import type { WingFriend } from "./friendsMock";

interface FriendsRowProps {
  friends: WingFriend[];
}

function handleFriendPress(_friendId: string) {
  // TODO: router.push(`/matchmaker/select?preselect=${friendId}`)
}

const spring = { mass: 0.4, damping: 12, stiffness: 220 };

// Cards animate in with a 0/80/160ms stagger (up to 3) — start the row just
// after the last one so the whole screen reads as one considered sequence.
const ENTRANCE_DELAY = 280;

export function FriendsRow({ friends }: FriendsRowProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(250).delay(ENTRANCE_DELAY)}
      style={{ gap: spacing[4] }}
    >
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: fontSize.xs[0],
          letterSpacing: 1,
          textTransform: "uppercase",
          color: coral[500],
        }}
      >
        On Wing
      </Text>

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing[4], paddingRight: spacing[6] }}
        >
          {friends.map((friend, index) => (
            <FriendAvatarButton key={friend.id} friend={friend} index={index} />
          ))}
        </ScrollView>

        {/* Fades the last avatar toward the background instead of a hard
            crop, so the row visibly hints there's more to scroll to. */}
        <LinearGradient
          pointerEvents="none"
          colors={["transparent", surface.cream]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: spacing[8],
          }}
        />
      </View>
    </Animated.View>
  );
}

function FriendAvatarButton({ friend, index }: { friend: WingFriend; index: number }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleFriendPress(friend.id);
  }

  return (
    <Pressable
      onPressIn={() => (scale.value = withSpring(0.94, spring))}
      onPressOut={() => (scale.value = withSpring(1, spring))}
      onPress={handlePress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={friend.name}
      style={{ width: 64 }}
    >
      <Animated.View style={[{ alignItems: "center", gap: 6 }, animatedStyle]}>
        <Avatar name={friend.name} size={56} index={index} imageUri={friend.imageUri} />
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.sm[0],
            color: ink[500],
            textAlign: "center",
          }}
          numberOfLines={1}
        >
          {friend.name.split(" ")[0]}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default FriendsRow;
