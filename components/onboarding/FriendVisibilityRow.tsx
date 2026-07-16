import { View, Text, Switch, Platform } from "react-native";
import { coral, ink, plum, surface } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { radii } from "../../constants/spacing";
import { Badge } from "../ui/Badge";

// Alternating tint so a long list of initials avatars doesn't read as flat.
const TINTS = [
  { bg: plum[100], text: plum[600] },
  { bg: coral[100], text: coral[600] },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function FriendVisibilityRow({
  id,
  name,
  index,
  value,
  onToggle,
  isNew,
  caption,
}: {
  id: string;
  name: string;
  index: number;
  value: boolean;
  onToggle: (id: string) => void;
  isNew?: boolean;
  caption?: string;
}) {
  const tint = TINTS[index % TINTS.length];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        gap: 14,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radii.pill,
          backgroundColor: tint.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: tint.text }}>
          {initials(name)}
        </Text>
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 16, color: ink[900] }}>{name}</Text>
          {isNew && <Badge label="NEW" tone="butter" />}
        </View>
        {caption && (
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: ink[500] }}>{caption}</Text>
        )}
      </View>

      <Switch
        value={value}
        onValueChange={() => onToggle(id)}
        trackColor={{ false: ink[300], true: coral[500] }}
        thumbColor={Platform.OS === "android" ? surface.paper : undefined}
        ios_backgroundColor={ink[300]}
      />
    </View>
  );
}
