import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { surface, ink } from "../../constants/colors";
import { fonts } from "../../constants/typography";

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: surface.cream,
        alignItems: "center",
        justifyContent: "center",
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: 28,
          color: ink[900],
          letterSpacing: -0.5,
        }}
      >
        Onboarding coming next.
      </Text>
    </View>
  );
}
