import { useState } from "react";
import {
  Image,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { coral, ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { elevation } from "../../constants/elevation";
import type { WingFriend } from "./friendsMock";

interface WingCardStackProps {
  friends: WingFriend[];
}

// Matches FriendsRow's own entrance delay — this replaces that row 1:1 on
// the wingman home screen, so it should animate in at the same beat.
const ENTRANCE_DELAY = 280;

function StackDots({ count, activeIndex }: { count: number; activeIndex: number }) {
  if (count <= 1) return null;
  return (
    <View style={{ flexDirection: "row", gap: 6, justifyContent: "center" }}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            width: i === activeIndex ? 20 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === activeIndex ? coral[500] : ink[200],
          }}
        />
      ))}
    </View>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function WingCard({ friend }: { friend: WingFriend }) {
  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/friend/${friend.id}` as never);
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={friend.name}
    >
      {({ pressed }) => (
        <View style={[elevation.sm, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
          <View style={{ borderRadius: radii.xl, overflow: "hidden", aspectRatio: 4 / 5 }}>
            {friend.imageUri ? (
              <Image source={{ uri: friend.imageUri }} style={{ width: "100%", height: "100%" }} />
            ) : (
              <View
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: coral[100],
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize["4xl"][0], color: coral[600] }}>
                  {initials(friend.name)}
                </Text>
              </View>
            )}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.55)"]}
              style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "40%" }}
            />
            <View style={{ position: "absolute", left: spacing[4], bottom: spacing[4] }}>
              <Text style={{ fontFamily: fonts.display, fontSize: fontSize["2xl"][0], lineHeight: fontSize["2xl"][1], color: "#FFFFFF" }}>
                {friend.name.split(" ")[0]}
              </Text>
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export function WingCardStack({ friends }: WingCardStackProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  function handleLayout(e: LayoutChangeEvent) {
    setContainerWidth(e.nativeEvent.layout.width);
  }

  function handleMomentumScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!containerWidth) return;
    setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / containerWidth));
  }

  return (
    <Animated.View entering={FadeInDown.duration(250).delay(ENTRANCE_DELAY)} style={{ gap: spacing[4] }}>
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

      <View onLayout={handleLayout} style={{ gap: spacing[4] }}>
        {containerWidth > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleMomentumScrollEnd}
          >
            {friends.map((friend) => (
              <View key={friend.id} style={{ width: containerWidth, padding: 2 }}>
                <WingCard friend={friend} />
              </View>
            ))}
          </ScrollView>
        )}
        <StackDots count={friends.length} activeIndex={activeIndex} />
      </View>
    </Animated.View>
  );
}

export default WingCardStack;
