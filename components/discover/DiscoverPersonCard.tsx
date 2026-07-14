import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Badge } from "../ui/Badge";
import { ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { elevation } from "../../constants/elevation";
import type { DiscoverPerson } from "./mockDiscoverPeople";
import type { WingFriend } from "../home/friendsMock";

interface DiscoverPersonCardProps {
  person: DiscoverPerson;
  mutuals: WingFriend[];
  index: number;
}

const spring = { mass: 0.4, damping: 12, stiffness: 220 };

function mutualCaption(mutuals: WingFriend[]): string {
  if (mutuals.length === 0) return "";
  const firstName = mutuals[0].name.split(" ")[0];
  return mutuals.length === 1 ? `via ${firstName}` : `via ${firstName} +${mutuals.length - 1}`;
}

export function DiscoverPersonCard({ person, mutuals, index }: DiscoverPersonCardProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const mutualIds = mutuals.map((m) => m.id).join(",");
    router.push(`/request/${person.id}?mutualIds=${mutualIds}` as never);
  }

  return (
    <Animated.View entering={FadeInDown.duration(250).delay(index * 60)}>
      <Pressable
        onPressIn={() => (scale.value = withSpring(0.98, spring))}
        onPressOut={() => (scale.value = withSpring(1, spring))}
        onPress={handlePress}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${person.name}, ${mutualCaption(mutuals)}`}
      >
        <Animated.View style={[elevation.sm, animatedStyle, { gap: spacing[2] }]}>
          <View style={{ borderRadius: radii.xl, overflow: "hidden", aspectRatio: 4 / 5 }}>
            <Image source={{ uri: person.photos[0] }} style={{ width: "100%", height: "100%" }} />
          </View>
          <View style={{ gap: 2 }}>
            <Text
              style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.base[0], color: ink[900] }}
              numberOfLines={1}
            >
              {person.name.split(" ")[0]}
            </Text>
            <Text
              style={{ fontFamily: fonts.body, fontSize: fontSize.sm[0], color: ink[500] }}
              numberOfLines={1}
            >
              {person.meta}
            </Text>
            <Badge label={mutualCaption(mutuals)} tone="plum" />
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export default DiscoverPersonCard;
