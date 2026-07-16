import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { coral, ink, surface } from "../../constants/colors";
import { fonts, textStyles } from "../../constants/typography";
import { radii } from "../../constants/spacing";
import { FriendVisibilityRow } from "./FriendVisibilityRow";

// Below this, everyone fits on one screen without scrolling to search.
const SEARCH_THRESHOLD = 6;

function QuickActionPill({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      {({ pressed }) => (
        <View
          style={{
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: radii.sm,
            backgroundColor: pressed ? ink[100] : surface.paper,
            borderWidth: 1,
            borderColor: ink[200],
          }}
        >
          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: 11,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: ink[700],
            }}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function FriendVisibilityList({
  friends,
  visibility,
  onToggle,
  onSelectAll,
  onSelectNone,
}: {
  friends: { id: string; name: string; isNew?: boolean; caption?: string }[];
  visibility: Record<string, boolean>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => f.name.toLowerCase().includes(q));
  }, [friends, search]);

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <QuickActionPill label="Select All" onPress={onSelectAll} />
        <QuickActionPill label="None" onPress={onSelectNone} />
      </View>

      {friends.length > SEARCH_THRESHOLD && (
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search friends"
          placeholderTextColor={ink[500]}
          style={{
            height: 48,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: ink[200],
            backgroundColor: surface.paper,
            paddingHorizontal: 16,
            fontFamily: fonts.body,
            fontSize: 16,
            color: ink[900],
            marginBottom: 8,
          }}
        />
      )}

      <View>
        {filtered.map((friend, i) => (
          <FriendVisibilityRow
            key={friend.id}
            id={friend.id}
            name={friend.name}
            index={i}
            value={visibility[friend.id] ?? false}
            onToggle={onToggle}
            isNew={friend.isNew}
            caption={friend.caption}
          />
        ))}
        {filtered.length === 0 && (
          <Text style={{ ...textStyles.caption, textAlign: "center", marginTop: 24 }}>
            No friends match "{search}"
          </Text>
        )}
      </View>
    </View>
  );
}
