import { useState } from "react";
import { LayoutChangeEvent, View } from "react-native";
import { spacing } from "../../constants/spacing";
import { FriendPickerChip } from "./FriendPickerChip";
import { getFriendEligibility, type MatchmakerFriend } from "./mockMatchmakerFriends";

interface FriendPickerGridProps {
  friends: MatchmakerFriend[];
  selectedIds: string[];
  onToggle: (friendId: string) => void;
}

const COLUMNS = 4;

export function FriendPickerGrid({ friends, selectedIds, onToggle }: FriendPickerGridProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const gap = spacing[4];
  const chipWidth = containerWidth > 0 ? (containerWidth - gap * (COLUMNS - 1)) / COLUMNS : 0;

  function handleLayout(event: LayoutChangeEvent) {
    setContainerWidth(event.nativeEvent.layout.width);
  }

  return (
    <View
      onLayout={handleLayout}
      style={{ flexDirection: "row", flexWrap: "wrap", gap }}
    >
      {friends.map((friend, index) => {
        const eligibility = getFriendEligibility(friend);
        return (
          <View key={friend.id} style={{ width: chipWidth || undefined }}>
            <FriendPickerChip
              friend={friend}
              index={index}
              eligibility={eligibility}
              selected={selectedIds.includes(friend.id)}
              atSelectionLimit={selectedIds.length >= 2}
              onToggle={onToggle}
            />
          </View>
        );
      })}
    </View>
  );
}

export default FriendPickerGrid;
