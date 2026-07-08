import { Text } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Button } from "../ui/Button";
import { ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

interface EmptySentIntrosStateProps {
  onMakeIntroPress?: () => void;
}

export function EmptySentIntrosState({ onMakeIntroPress }: EmptySentIntrosStateProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(260).delay(80)}
      style={{
        alignItems: "center",
        paddingVertical: spacing[8],
        paddingHorizontal: spacing[6],
        gap: spacing[4],
      }}
    >
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: fontSize["2xl"][0],
          lineHeight: fontSize["2xl"][1],
          color: ink[900],
          letterSpacing: -0.2,
          textAlign: "center",
        }}
      >
        You haven&rsquo;t set anyone up yet.
      </Text>
      <Text
        style={{
          fontFamily: fonts.body,
          fontSize: fontSize.base[0],
          lineHeight: fontSize.base[1],
          color: ink[500],
          textAlign: "center",
        }}
      >
        Somebody in your contacts is somebody&rsquo;s answer.
      </Text>
      <Button
        title="Make an intro"
        onPress={onMakeIntroPress}
        style={{ marginTop: spacing[2] }}
      />
    </Animated.View>
  );
}

export default EmptySentIntrosState;
