import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
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
import Svg, { Circle, Path } from "react-native-svg";
import { coral, ink, plum } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";

interface HomeHeaderProps {
  name?: string;
  loading?: boolean;
  subhead?: string;
  onInvitePress?: () => void;
  onDiscoverPress?: () => void;
}

function DiscoverIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7" stroke={ink[900]} strokeWidth={2} />
      <Path d="M21 21l-4.3-4.3" stroke={ink[900]} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function HomeHeader({ name, loading, subhead, onInvitePress, onDiscoverPress }: HomeHeaderProps) {
  return (
    <Animated.View entering={FadeInDown.duration(250)} style={{ gap: spacing[2] }}>
      <View
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

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
          <Pressable
            onPress={onDiscoverPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Discover"
          >
            <DiscoverIcon />
          </Pressable>
          <Button
            title="Invite"
            variant="outline"
            onPress={onInvitePress}
            style={{ height: 44, paddingHorizontal: 16, borderColor: plum[100] }}
          />
        </View>
      </View>

      {!loading && subhead && (
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.sm[0],
            lineHeight: fontSize.sm[1],
            color: ink[500],
          }}
        >
          {subhead}
        </Text>
      )}
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
