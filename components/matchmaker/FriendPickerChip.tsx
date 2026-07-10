import { Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Avatar } from "../ui/Avatar";
import { coral, ink, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii } from "../../constants/spacing";
import {
  getIneligibleCaption,
  type FriendEligibility,
  type MatchmakerFriend,
} from "./mockMatchmakerFriends";

interface FriendPickerChipProps {
  friend: MatchmakerFriend;
  index: number;
  eligibility: FriendEligibility;
  selected: boolean;
  atSelectionLimit: boolean;
  onToggle: (friendId: string) => void;
}

function CheckIcon() {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 13l4 4L19 7"
        stroke="#FFFFFF"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function FriendPickerChip({
  friend,
  index,
  eligibility,
  selected,
  atSelectionLimit,
  onToggle,
}: FriendPickerChipProps) {
  const shakeX = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const interactive = eligibility === "eligible";
  const caption = interactive ? undefined : getIneligibleCaption(eligibility);

  function handlePress() {
    if (!interactive) return;

    if (!selected && atSelectionLimit) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      shakeX.value = withSequence(
        withTiming(-6, { duration: 40 }),
        withTiming(6, { duration: 80 }),
        withTiming(-4, { duration: 80 }),
        withTiming(4, { duration: 80 }),
        withTiming(0, { duration: 60 })
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(friend.id);
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={!interactive}
      accessible
      accessibilityRole="button"
      accessibilityLabel={friend.name}
      accessibilityState={{ selected, disabled: !interactive }}
      style={{ width: "100%" }}
    >
      <Animated.View
        style={[{ alignItems: "center", gap: 6, opacity: interactive ? 1 : 0.4 }, animatedStyle]}
      >
        <View style={{ width: 64, height: 64, alignItems: "center", justifyContent: "center" }}>
          {selected && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 62,
                height: 62,
                borderRadius: radii.pill,
                borderWidth: 2.5,
                borderColor: coral[500],
              }}
            />
          )}
          <Avatar name={friend.name} size={56} index={index} imageUri={friend.imageUri} />
          {selected && (
            <View
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 20,
                height: 20,
                borderRadius: radii.pill,
                backgroundColor: coral[500],
                borderWidth: 2,
                borderColor: surface.paper,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CheckIcon />
            </View>
          )}
        </View>
        <Text
          style={{ fontFamily: fonts.body, fontSize: fontSize.sm[0], color: ink[900], textAlign: "center" }}
          numberOfLines={1}
        >
          {friend.name.split(" ")[0]}
        </Text>
        {caption ? (
          <Text
            style={{ fontFamily: fonts.body, fontSize: fontSize.xs[0], color: ink[500], textAlign: "center" }}
            numberOfLines={2}
          >
            {caption}
          </Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

export default FriendPickerChip;
