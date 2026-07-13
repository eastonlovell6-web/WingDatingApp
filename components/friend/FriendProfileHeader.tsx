import { Text, View } from "react-native";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

interface FriendProfileHeaderProps {
  name: string;
  meta: string;
  avatarUri?: string;
  // Shows a "Solely a wingman" badge under the meta line. Omit or pass
  // false for friends who are looking to get set up (the default state
  // gets no badge at all).
  showWingmanBadge?: boolean;
}

export function FriendProfileHeader({ name, meta, avatarUri, showWingmanBadge }: FriendProfileHeaderProps) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[4] }}>
      <Avatar name={name} imageUri={avatarUri} size={72} />
      <View style={{ gap: 2, flexShrink: 1 }}>
        <Text
          style={{
            fontFamily: fonts.displaySemibold,
            fontSize: fontSize["2xl"][0],
            lineHeight: fontSize["2xl"][1],
            letterSpacing: -0.2,
            color: ink[900],
          }}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.sm[0],
            lineHeight: fontSize.sm[1],
            color: ink[500],
          }}
          numberOfLines={1}
        >
          {meta}
        </Text>
        {showWingmanBadge && (
          <View style={{ marginTop: 4 }}>
            <Badge label="Solely a wingman" tone="plum" />
          </View>
        )}
      </View>
    </View>
  );
}

export default FriendProfileHeader;
