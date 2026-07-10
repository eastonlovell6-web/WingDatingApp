import { Pressable, Text, View } from "react-native";
import { Button } from "../ui/Button";
import { ink } from "../../constants/colors";
import { fonts, fontSize, textStyles } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

interface MatchmakerEncouragementStateProps {
  onInvitePress: () => void;
  onNotNowPress: () => void;
}

export function MatchmakerEncouragementState({
  onInvitePress,
  onNotNowPress,
}: MatchmakerEncouragementStateProps) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing[6],
        paddingHorizontal: spacing[6],
      }}
    >
      <View style={{ gap: spacing[2] }}>
        <Text style={[textStyles.heading, { textAlign: "center" }]}>
          Matchmaking takes two (of your friends)
        </Text>
        <Text style={[textStyles.caption, { textAlign: "center" }]}>
          Invite friends to Wing so you can start setting people up.
        </Text>
      </View>
      <Button title="Invite friends" onPress={onInvitePress} />
      <Pressable onPress={onNotNowPress} hitSlop={8} accessibilityRole="button" accessibilityLabel="Not now">
        <Text style={{ fontFamily: fonts.body, fontSize: fontSize.sm[0], color: ink[500] }}>
          Not now
        </Text>
      </Pressable>
    </View>
  );
}

export default MatchmakerEncouragementState;
