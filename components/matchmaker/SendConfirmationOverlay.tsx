import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { ink, mint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { elevation } from "../../constants/elevation";

interface SendConfirmationOverlayProps {
  visible: boolean;
  onDismiss: () => void;
}

function CheckIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 13l4 4L19 7"
        stroke="#FFFFFF"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * "Your intro is on its way" confirmation — the Matchmaker-send
 * micro-interaction specified in CLAUDE.md. Auto-dismisses via onDismiss
 * 1.5s after becoming visible.
 */
export function SendConfirmationOverlay({ visible, onDismiss }: SendConfirmationOverlayProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, 1500);
    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(180)}
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(26,20,18,0.35)",
      }}
    >
      <View
        style={[
          elevation.md,
          {
            alignItems: "center",
            gap: spacing[4],
            backgroundColor: surface.paper,
            borderRadius: radii.xl,
            paddingVertical: spacing[8],
            paddingHorizontal: spacing[10],
          },
        ]}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radii.pill,
            backgroundColor: mint[500],
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckIcon />
        </View>
        <Text
          style={{
            fontFamily: fonts.bodyMedium,
            fontSize: fontSize.base[0],
            color: ink[900],
            textAlign: "center",
          }}
        >
          Your intro is on its way
        </Text>
      </View>
    </Animated.View>
  );
}

export default SendConfirmationOverlay;
