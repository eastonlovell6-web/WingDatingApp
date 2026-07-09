import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { coral, ink, plum } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";

const RING_SIZE = 160;
const STROKE_WIDTH = 14;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const FILL_DURATION = 1100;
const FLIP_DURATION = 450;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface MatchmakerScoreRingProps {
  score: number;
  rankTier: string;
  rankLevel: number;
}

export function MatchmakerScoreRing({ score, rankTier, rankLevel }: MatchmakerScoreRingProps) {
  const progress = useSharedValue(0);
  const flip = useSharedValue(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: FILL_DURATION, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setReady)(true);
      }
    );
    return () => {
      cancelAnimation(progress);
      cancelAnimation(flip);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - (score / 100) * progress.value),
  }));

  const countAnimatedProps = useAnimatedProps(() => ({
    text: `${Math.round(progress.value * score)}`,
  }));

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { rotateY: `${flip.value}deg` }],
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { rotateY: `${flip.value + 180}deg` }],
  }));

  function handleFlip() {
    if (!ready) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flip.value = withTiming(flip.value === 0 ? 180 : 0, {
      duration: FLIP_DURATION,
      easing: Easing.inOut(Easing.quad),
    });
  }

  return (
    <Pressable
      onPress={handleFlip}
      accessibilityRole="button"
      accessibilityLabel="Matchmaker score, tap to see rank"
      style={{ alignSelf: "center" }}
    >
      <View style={{ width: RING_SIZE, height: RING_SIZE }}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Defs>
            <LinearGradient id="scoreRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={coral[500]} />
              <Stop offset="100%" stopColor={plum[500]} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={ink[200]}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          <AnimatedCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke="url(#scoreRingGradient)"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            animatedProps={ringAnimatedProps}
            rotation={-90}
            originX={RING_SIZE / 2}
            originY={RING_SIZE / 2}
          />
        </Svg>

        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Animated.View
            style={[{ position: "absolute", backfaceVisibility: "hidden" }, frontStyle]}
          >
            <AnimatedTextInput
              editable={false}
              caretHidden
              pointerEvents="none"
              underlineColorAndroid="transparent"
              defaultValue="0"
              animatedProps={countAnimatedProps as any}
              style={{
                fontFamily: fonts.display,
                fontSize: fontSize["5xl"][0],
                lineHeight: fontSize["5xl"][1],
                color: coral[500],
                padding: 0,
                textAlign: "center",
              }}
            />
          </Animated.View>

          <Animated.View
            style={[
              {
                position: "absolute",
                backfaceVisibility: "hidden",
                alignItems: "center",
                width: RING_SIZE - STROKE_WIDTH * 2,
              },
              backStyle,
            ]}
          >
            <Text
              numberOfLines={2}
              style={{
                fontFamily: fonts.displaySemibold,
                fontSize: fontSize.lg[0],
                lineHeight: fontSize.lg[1],
                color: coral[500],
                textAlign: "center",
              }}
            >
              {rankTier}
            </Text>
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: fontSize.xs[0],
                letterSpacing: 1,
                textTransform: "uppercase",
                color: ink[500],
                marginTop: 2,
              }}
            >
              {`Lvl ${rankLevel}`}
            </Text>
          </Animated.View>
        </View>
      </View>
    </Pressable>
  );
}

export default MatchmakerScoreRing;
