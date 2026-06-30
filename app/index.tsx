import { View, Text, Pressable, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { Button } from "../components/ui/Button";
import { coral, blush, ink, surface } from "../constants/colors";
import { fonts } from "../constants/typography";

/** White paper-plane lockup mark, angled up-and-to-the-right. */
function WingMark({ size = 30 }: { size?: number }) {
  return (
    <View style={{ transform: [{ rotate: "-8deg" }] }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M21.426 11.095 4.574 3.36a1 1 0 0 0-1.39 1.18l1.86 5.58a1 1 0 0 0 .77.67l6.19 1.03-6.19 1.03a1 1 0 0 0-.77.67l-1.86 5.58a1 1 0 0 0 1.39 1.18l16.852-7.735a1 1 0 0 0 0-1.81Z"
          fill="#FFFFFF"
        />
      </Svg>
    </View>
  );
}

/** Thin right-arrow for the CTA. */
function ArrowRight({ color = "#FFFFFF", size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12h15M13 6l6 6-6 6"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function GetStarted() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // TODO(phone-entry): router.push("/(auth)") once the phone screen exists.
  const handleGetStarted = () => {};
  // TODO(sign-in): route to the "I have an account" sign-in flow.
  const handleSignIn = () => {};

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      <StatusBar style="light" />

      {/* Sunset hero — bleeds under the status bar to the top edge. */}
      <Animated.View entering={FadeIn.duration(400)}>
        <LinearGradient
          colors={[coral[500], coral[300], blush[300]]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{
            height: height * 0.46,
            alignItems: "center",
            justifyContent: "center",
            paddingTop: insets.top,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <WingMark size={34} />
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 52,
                color: "#FFFFFF",
                letterSpacing: -1,
              }}
            >
              Wing
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Cream content */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 24,
          paddingTop: 40,
          paddingBottom: insets.bottom + 24,
          justifyContent: "space-between",
        }}
      >
        <Animated.View entering={FadeInDown.duration(260).delay(120)}>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 42,
              lineHeight: 46,
              letterSpacing: -1,
              color: ink[900],
            }}
          >
            Ghosted?{"\n"}You need a{"\n"}
            <Text style={{ color: coral[500] }}>wingman.</Text>
          </Text>

          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: 18,
              lineHeight: 26,
              color: ink[500],
              marginTop: 20,
            }}
          >
            No swiping on strangers. Every match starts with a friend.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(260).delay(220)}>
          <Button
            title="Get started"
            onPress={handleGetStarted}
            rightIcon={<ArrowRight />}
          />

          <Pressable
            onPress={handleSignIn}
            hitSlop={12}
            style={{
              flexDirection: "row",
              justifyContent: "center",
              marginTop: 24,
            }}
          >
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15, color: ink[900] }}>
              Already on Wing?{" "}
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 15, color: ink[500] }}>
              I have an account
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}
