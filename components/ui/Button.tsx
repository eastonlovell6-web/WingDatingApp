import { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { coral, ink, plum } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { radii } from "../../constants/spacing";

type Variant = "primary" | "secondary" | "outline";

interface ButtonProps {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  /** Optional element rendered after the label (e.g. an arrow icon). */
  rightIcon?: ReactNode;
  style?: ViewStyle;
}

/**
 * The app's primary action. Coral pill by default; spring-scales and fires a
 * light haptic on press. `secondary` / `outline` are styled per the design
 * system for later screens — `primary` is the fully-exercised path today.
 */
const variants: Record<
  Variant,
  { bg: string; pressedBg: string; text: string; borderColor?: string }
> = {
  primary: { bg: coral[500], pressedBg: coral[700], text: "#FFFFFF" },
  secondary: { bg: plum[100], pressedBg: "#DFC9E6", text: ink[900] },
  outline: {
    bg: "transparent",
    pressedBg: ink[100],
    text: ink[900],
    borderColor: ink[300],
  },
};

// Warm coral glow under the primary button — never pure-black shadow.
const primaryGlow: ViewStyle = {
  shadowColor: coral[500],
  shadowOpacity: 0.4,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 8,
};

const spring = { mass: 0.4, damping: 12, stiffness: 220 };

export function Button({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
  rightIcon,
  style,
}: ButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const v = variants[variant];
  const inactive = disabled || loading;

  const handlePressIn = () => {
    if (inactive) return;
    scale.value = withSpring(0.97, spring);
  };
  const handlePressOut = () => {
    if (inactive) return;
    scale.value = withSpring(1, spring);
  };
  const handlePress = () => {
    if (inactive) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={inactive}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            {
              height: 60,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              paddingHorizontal: 28,
              borderRadius: radii.pill,
              backgroundColor: disabled
                ? coral[100]
                : pressed
                  ? v.pressedBg
                  : v.bg,
              borderWidth: v.borderColor ? 1.5 : 0,
              borderColor: v.borderColor,
            },
            variant === "primary" && !disabled ? primaryGlow : null,
            animatedStyle,
            style,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={disabled ? ink[500] : v.text} />
          ) : (
            <>
              <Text
                style={{
                  fontFamily: fonts.bodyMedium,
                  fontSize: 17,
                  letterSpacing: 0.2,
                  color: disabled ? ink[500] : v.text,
                }}
              >
                {title}
              </Text>
              {rightIcon}
            </>
          )}
        </Animated.View>
      )}
    </Pressable>
  );
}

export default Button;
