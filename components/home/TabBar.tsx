import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Line, Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { coral, gradients, ink, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { ChatsGlyph, IntrosGlyph } from "../ui/TabGlyphs";

const TAB_LABELS: Record<string, string> = {
  index: "For You",
  intros: "Intros",
  chats: "Chats",
  profile: "You",
};

// Floating pill height + how far the FAB overhangs above it + its gap from
// the screen edge — scrollable content must reserve at least this much
// bottom space or the tab bar/FAB sits on top of (and clips) real content.
const TAB_BAR_HEIGHT = 72;
const FAB_OVERHANG = 28;
const TAB_BAR_BOTTOM_GAP = spacing[2];
export const TAB_BAR_CLEARANCE = TAB_BAR_HEIGHT + FAB_OVERHANG + TAB_BAR_BOTTOM_GAP;

function TabIcon({ name, color, size = 22 }: { name: string; color: string; size?: number }) {
  switch (name) {
    case "index":
      // Distinct from the WingMark paper-plane logo in the header — a plain
      // home glyph so the tab bar doesn't visually repeat the brand mark.
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 11.5 12 4l8 7.5M6 10v9h5v-5h2v5h5v-9"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case "intros":
      // Two overlapping circles — a mutual connection, not a heart (avoids
      // swipe-app iconography that clashes with Wing's positioning).
      return <IntrosGlyph size={size} color={color} />;
    case "chats":
      return <ChatsGlyph size={size} color={color} />;
    case "profile":
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={8} r={3.4} stroke={color} strokeWidth={1.8} />
          <Path d="M5 19c1.4-3.2 4-4.8 7-4.8S17.6 15.8 19 19" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
      );
    default:
      return null;
  }
}

function PlusIcon({ size = 22, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1={12} y1={5} x2={12} y2={19} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Line x1={5} y1={12} x2={19} y2={12} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  function handleFabPress() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // TODO: router.push('/matchmaker/select')
  }

  return (
    <View
      style={{
        position: "absolute",
        left: spacing[6],
        right: spacing[6],
        bottom: insets.bottom + spacing[2],
        alignItems: "center",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          height: 72,
          borderRadius: radii.pill,
          backgroundColor: surface.paper,
          paddingHorizontal: spacing[6],
          shadowColor: shadowTint,
          shadowOpacity: 1,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        }}
      >
        {state.routes.map((route, i) => {
          const isFocused = state.index === i;
          const label = TAB_LABELS[route.name] ?? route.name;
          const color = isFocused ? coral[500] : ink[300];

          // Leave a gap in the middle for the FAB to straddle.
          if (i === 2) {
            return (
              <View key={`${route.key}-spacer`} style={{ width: 56, flexDirection: "row" }}>
                <TabButton
                  route={route}
                  isFocused={isFocused}
                  label={label}
                  color={color}
                  navigation={navigation}
                />
              </View>
            );
          }

          return (
            <TabButton
              key={route.key}
              route={route}
              isFocused={isFocused}
              label={label}
              color={color}
              navigation={navigation}
            />
          );
        })}
      </View>

      <Pressable
        onPress={handleFabPress}
        style={{ position: "absolute", top: -28 }}
      >
        <LinearGradient
          colors={gradients.sunset}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 56,
            height: 56,
            borderRadius: radii.pill,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: coral[500],
            shadowOpacity: 0.4,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          }}
        >
          <PlusIcon />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function TabButton({
  route,
  isFocused,
  label,
  color,
  navigation,
}: {
  route: BottomTabBarProps["state"]["routes"][number];
  isFocused: boolean;
  label: string;
  color: string;
  navigation: BottomTabBarProps["navigation"];
}) {
  function handlePress() {
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      style={{ alignItems: "center", justifyContent: "center", gap: 4, flex: 1 }}
    >
      <TabIcon name={route.name} color={color} />
      {isFocused && (
        <Text
          style={{
            fontFamily: fonts.bodyMedium,
            fontSize: fontSize["2xs"][0],
            color,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export default TabBar;
