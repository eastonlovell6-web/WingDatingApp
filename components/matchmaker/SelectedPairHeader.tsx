import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Avatar } from "../ui/Avatar";
import { coral, ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";
import type { MatchmakerFriend } from "./mockMatchmakerFriends";

interface SelectedPairHeaderProps {
  friendA: MatchmakerFriend;
  friendB: MatchmakerFriend;
}

function ConnectorIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={coral[500]} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

function PersonColumn({ friend, index }: { friend: MatchmakerFriend; index: number }) {
  return (
    <View style={{ alignItems: "center", gap: spacing[2] }}>
      <Avatar name={friend.name} size={72} index={index} imageUri={friend.imageUri} />
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.base[0], color: ink[900] }}>
        {friend.name.split(" ")[0]}
      </Text>
    </View>
  );
}

/**
 * Compact "who's meeting" header for the Matchmaker note screen — avatars +
 * first names only, since MatchmakerFriend carries no age/tagline the way
 * TwoPersonHeader's PersonHeaderInfo does.
 */
export function SelectedPairHeader({ friendA, friendB }: SelectedPairHeaderProps) {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing[6] }}
    >
      <PersonColumn friend={friendA} index={0} />
      <ConnectorIcon />
      <PersonColumn friend={friendB} index={1} />
    </View>
  );
}

export default SelectedPairHeader;
