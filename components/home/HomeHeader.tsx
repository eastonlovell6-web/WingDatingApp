import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Button } from "../ui/Button";
import { WingMark } from "../ui/WingMark";
import { coral, ink, plum } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii } from "../../constants/spacing";

interface HomeHeaderProps {
  name?: string;
  loading?: boolean;
  onInvitePress?: () => void;
}

export function HomeHeader({ name, loading, onInvitePress }: HomeHeaderProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, minWidth: 0 }}>
        <WingMark size={20} color={coral[500]} />
        {loading ? (
          <NameSkeleton />
        ) : (
          <Text
            style={{
              fontFamily: fonts.displaySemibold,
              fontSize: fontSize.xl[0],
              lineHeight: fontSize.xl[1],
              color: ink[900],
              flexShrink: 1,
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            Hey {name ?? "there"}
          </Text>
        )}
      </View>

      <Button
        title="Invite"
        variant="outline"
        onPress={onInvitePress}
        style={{ height: 44, paddingHorizontal: 16, borderColor: plum[100] }}
      />
    </Animated.View>
  );
}

// Pulses in place of "Hey {name}" while the profile query is in flight, so
// the screen never flashes the "there" fallback before the real name loads.
function NameSkeleton() {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width: 96,
          height: fontSize.xl[1],
          borderRadius: radii.sm,
          backgroundColor: ink[100],
        },
        animatedStyle,
      ]}
    />
  );
}

export default HomeHeader;
