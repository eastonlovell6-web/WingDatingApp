import { Pressable, ScrollView, Text, View } from "react-native";
import { Avatar } from "../ui/Avatar";
import { coral, ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";
import type { WingFriend } from "./friendsMock";

interface FriendsRowProps {
  friends: WingFriend[];
}

function handleFriendPress(_friendId: string) {
  // TODO: router.push(`/matchmaker/select?preselect=${friendId}`)
}

export function FriendsRow({ friends }: FriendsRowProps) {
  return (
    <View style={{ gap: spacing[4] }}>
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: fontSize.xs[0],
          letterSpacing: 1,
          textTransform: "uppercase",
          color: coral[500],
        }}
      >
        On Wing
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[4] }}
      >
        {friends.map((friend, index) => (
          <Pressable
            key={friend.id}
            onPress={() => handleFriendPress(friend.id)}
            style={{ alignItems: "center", width: 64, gap: 6 }}
          >
            <Avatar name={friend.name} size={56} index={index} imageUri={friend.imageUri} />
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: fontSize.sm[0],
                color: ink[500],
                textAlign: "center",
              }}
              numberOfLines={1}
            >
              {friend.name.split(" ")[0]}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default FriendsRow;
