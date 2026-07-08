import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { coral, ink, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii } from "../../constants/spacing";

const spring = { mass: 0.5, damping: 16, stiffness: 220 };
const TRACK_PADDING = 4;

interface ProfileSegmentedControlProps {
  segments: string[];
  activeIndex: number;
  onChange: (index: number) => void;
}

export function ProfileSegmentedControl({ segments, activeIndex, onChange }: ProfileSegmentedControlProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const segmentWidth = trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / segments.length : 0;
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (segmentWidth > 0) {
      translateX.value = withSpring(activeIndex * segmentWidth, spring);
    }
  }, [activeIndex, segmentWidth, translateX]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={{
        flexDirection: "row",
        backgroundColor: surface.creamDeep,
        borderRadius: radii.pill,
        padding: TRACK_PADDING,
      }}
    >
      {segmentWidth > 0 && (
        <Animated.View
          style={[
            {
              position: "absolute",
              top: TRACK_PADDING,
              left: TRACK_PADDING,
              width: segmentWidth,
              height: 36,
              borderRadius: radii.pill,
              backgroundColor: surface.paper,
              shadowColor: shadowTint,
              shadowOpacity: 1,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            },
            pillStyle,
          ]}
        />
      )}

      {segments.map((label, i) => {
        const isActive = i === activeIndex;
        return (
          <Pressable
            key={label}
            onPress={() => {
              if (i !== activeIndex) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onChange(i);
              }
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={{ flex: 1, height: 36, alignItems: "center", justifyContent: "center" }}
          >
            <Text
              style={{
                fontFamily: fonts.bodyMedium,
                fontSize: fontSize.sm[0],
                color: isActive ? coral[500] : ink[500],
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default ProfileSegmentedControl;
