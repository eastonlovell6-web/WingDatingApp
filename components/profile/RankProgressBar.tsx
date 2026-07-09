import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { coral, ink, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";

const BAR_HEIGHT = 6;
// Starts right after MatchmakerScoreRing's ~1100ms fill animation settles,
// so the two gauges don't visually compete for attention.
const FILL_DELAY = 1100;
const FILL_DURATION = 700;

const FLAME_PATH =
  "M12 2C12 2 6 9 6 14C6 17.31 8.69 20 12 20C15.31 20 18 17.31 18 14C18 9 12 2 12 2Z";

function StreakFlame({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={FLAME_PATH} fill={coral[500]} />
    </Svg>
  );
}

interface RankProgressBarProps {
  xpCurrent: number;
  xpForNextLevel: number;
  streakWeeks: number;
}

export function RankProgressBar({ xpCurrent, xpForNextLevel, streakWeeks }: RankProgressBarProps) {
  const [trackWidth, setTrackWidth] = useState(0);
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

  const fillStyle = useAnimatedStyle(() => ({ width: fillWidth.value }));

  return (
    <View style={{ gap: spacing[2] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text
          style={{
            fontFamily: fonts.monoMedium,
            fontSize: fontSize.xs[0],
            letterSpacing: 1,
            textTransform: "uppercase",
            color: ink[500],
          }}
        >
          {`${xpCurrent} / ${xpForNextLevel} XP TO NEXT LEVEL`}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <StreakFlame />
          <Text style={{ fontFamily: fonts.monoMedium, fontSize: fontSize.xs[0], color: ink[900] }}>
            {streakWeeks}
          </Text>
        </View>
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
