import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { butter, coral, ink, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";

const BAR_HEIGHT = 6;
// Starts right after MatchmakerScoreRing's ~1100ms fill animation settles,
// so the two gauges don't visually compete for attention.
const FILL_DELAY = 1100;
const FILL_DURATION = 700;
const STREAK_TOOLTIP_AUTO_HIDE = 2500;

const FLAME_PATH =
  "M12 2C12 2 6 9 6 14C6 17.31 8.69 20 12 20C15.31 20 18 17.31 18 14C18 9 12 2 12 2Z";

function StreakFlame({ size = 14, color = coral[500] }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={FLAME_PATH} fill={color} />
    </Svg>
  );
}

interface RankProgressBarProps {
  xpCurrent: number;
  xpForNextLevel: number;
  streakWeeks: number;
  streakAtRisk?: boolean;
  streakResetsInDays?: number;
}

export function RankProgressBar({
  xpCurrent,
  xpForNextLevel,
  streakWeeks,
  streakAtRisk = false,
  streakResetsInDays = 0,
}: RankProgressBarProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [streakTooltipVisible, setStreakTooltipVisible] = useState(false);
  const fillWidth = useSharedValue(0);
  const fraction = xpForNextLevel > 0 ? Math.min(xpCurrent / xpForNextLevel, 1) : 0;

  useEffect(() => {
    if (trackWidth === 0) return;
    fillWidth.value = withDelay(
      FILL_DELAY,
      withTiming(trackWidth * fraction, { duration: FILL_DURATION, easing: Easing.out(Easing.quad) })
    );
    return () => cancelAnimation(fillWidth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackWidth, fraction]);

  useEffect(() => {
    if (!streakTooltipVisible) return;
    const timer = setTimeout(() => setStreakTooltipVisible(false), STREAK_TOOLTIP_AUTO_HIDE);
    return () => clearTimeout(timer);
  }, [streakTooltipVisible]);

  const fillStyle = useAnimatedStyle(() => ({ width: fillWidth.value }));

  const streakTooltipText = streakAtRisk
    ? `Streak ends in ${streakResetsInDays} day${streakResetsInDays === 1 ? "" : "s"}`
    : `${streakWeeks} week streak`;

  function handleStreakPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStreakTooltipVisible((visible) => !visible);
  }

  return (
    <View style={{ gap: spacing[4] }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          columnGap: spacing[2],
        }}
      >
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{
            fontFamily: fonts.monoMedium,
            fontSize: fontSize.xs[0],
            letterSpacing: 1,
            textTransform: "uppercase",
            color: ink[500],
            flexShrink: 1,
          }}
        >
          {`${xpCurrent}/${xpForNextLevel} XP`}
        </Text>
        <Pressable
          onPress={handleStreakPress}
          accessibilityRole="button"
          accessibilityLabel={streakTooltipText}
          hitSlop={8}
        >
          <View style={{ position: "relative", flexShrink: 0 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: streakAtRisk ? 8 : 0,
                paddingVertical: streakAtRisk ? 3 : 0,
                borderRadius: radii.pill,
                borderWidth: streakAtRisk ? 1.5 : 0,
                borderColor: streakAtRisk ? butter[500] : "transparent",
              }}
            >
              <StreakFlame color={streakAtRisk ? butter[700] : coral[500]} />
              <Text
                style={{
                  fontFamily: fonts.monoMedium,
                  fontSize: fontSize.xs[0],
                  color: ink[900],
                }}
              >
                {streakWeeks}
              </Text>
            </View>

            {streakTooltipVisible && (
              <View
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: 6,
                  backgroundColor: ink[900],
                  borderRadius: radii.sm,
                  paddingHorizontal: spacing[2],
                  paddingVertical: 4,
                  minWidth: 128,
                  zIndex: 10,
                }}
              >
                <Text
                  numberOfLines={2}
                  style={{
                    fontFamily: fonts.bodyMedium,
                    fontSize: fontSize["2xs"][0],
                    color: surface.paper,
                    textAlign: "center",
                  }}
                >
                  {streakTooltipText}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      </View>

      <View
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        style={{
          height: BAR_HEIGHT,
          borderRadius: radii.pill,
          backgroundColor: surface.creamDeep,
          overflow: "hidden",
        }}
      >
        <Animated.View
          style={[{ height: BAR_HEIGHT, borderRadius: radii.pill, backgroundColor: coral[500] }, fillStyle]}
        />
      </View>
    </View>
  );
}

export default RankProgressBar;
