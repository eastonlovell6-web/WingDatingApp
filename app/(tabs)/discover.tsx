import { useState } from "react";
import { LayoutChangeEvent, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { DiscoverPersonCard } from "../../components/discover/DiscoverPersonCard";
import { getDiscoverPeople } from "../../lib/discover";
import { useAuthStore } from "../../store/auth";
import { ink, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

const COLUMNS = 2;

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 8 12l7 7" stroke={ink[900]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const [containerWidth, setContainerWidth] = useState(0);
  const userId = useAuthStore((s) => s.user?.id);
  const { data: people, isLoading } = useQuery({
    queryKey: ["discoverPeople", userId],
    queryFn: getDiscoverPeople,
    enabled: !!userId,
  });
  const gap = spacing[4];
  const cardWidth = containerWidth > 0 ? (containerWidth - gap * (COLUMNS - 1)) / COLUMNS : 0;

  function handleLayout(event: LayoutChangeEvent) {
    setContainerWidth(event.nativeEvent.layout.width);
  }

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      <View
        style={{
          paddingTop: insets.top + spacing[2],
          paddingBottom: spacing[2],
          paddingHorizontal: spacing[4],
        }}
      >
        <Pressable
          onPress={() => router.canGoBack() && router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <BackIcon />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing[6],
          paddingTop: spacing[2],
          paddingBottom: insets.bottom + spacing[8],
          gap: spacing[6],
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontFamily: fonts.displaySemibold,
            fontSize: fontSize["2xl"][0],
            lineHeight: fontSize["2xl"][1],
            color: ink[900],
          }}
        >
          Discover
        </Text>

        {isLoading ? (
          <Text style={{ fontFamily: fonts.body, fontSize: fontSize.base[0], color: ink[500] }}>
            Loading...
          </Text>
        ) : !people || people.length === 0 ? (
          <Text style={{ fontFamily: fonts.body, fontSize: fontSize.base[0], color: ink[500] }}>
            No one to discover right now — check back once your friends make more connections.
          </Text>
        ) : (
          <View onLayout={handleLayout} style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
            {people.map((person, index) => (
              <View key={person.id} style={{ width: cardWidth || undefined }}>
                <DiscoverPersonCard person={person} index={index} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
