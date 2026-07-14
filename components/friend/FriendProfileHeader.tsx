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
  // Always renders a status badge under the meta line: "Looking to get set
  // up" (mint) when true, "Solely a wingman" (plum) when false.
  lookingToGetSetUp: boolean;
}

export function FriendProfileHeader({ name, meta, avatarUri, lookingToGetSetUp }: FriendProfileHeaderProps) {
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
        <View style={{ marginTop: 4 }}>
          {lookingToGetSetUp ? (
            <Badge label="Looking to get set up" tone="mint" />
          ) : (
            <Badge label="Solely a wingman" tone="plum" />
          )}
        </View>
      </View>
    </View>
  );
}

export default FriendProfileHeader;
