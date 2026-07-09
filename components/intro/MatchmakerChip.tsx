import { Text, View } from "react-native";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

interface MatchmakerChipProps {
  name: string;
  avatarUri?: string;
}

/** Mutual-friend context strip for the Intro Detail header: who sent this. */
export function MatchmakerChip({ name, avatarUri }: MatchmakerChipProps) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], flexShrink: 1 }}>
      <Avatar name={name} imageUri={avatarUri} size={28} />
      <Text
        style={{
          fontFamily: fonts.body,
          fontSize: fontSize.sm[0],
          lineHeight: fontSize.sm[1],
          color: ink[700],
          flexShrink: 1,
        }}
        numberOfLines={1}
      >
        Introduced by {name}
      </Text>
      <Badge label="Mutual friend" tone="plum" variant="solid" />
    </View>
  );
}

export default MatchmakerChip;
