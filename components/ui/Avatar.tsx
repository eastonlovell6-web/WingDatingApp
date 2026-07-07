import { Image, Text, View } from "react-native";
import { coral, plum } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { radii } from "../../constants/spacing";

// Alternating tint so a row of initials avatars doesn't read as flat.
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

interface AvatarProps {
  name: string;
  size?: number;
  index?: number;
  imageUri?: string;
}

export function Avatar({ name, size = 44, index = 0, imageUri }: AvatarProps) {
  const tint = TINTS[index % TINTS.length];

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={{
          width: size,
          height: size,
          borderRadius: radii.pill,
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radii.pill,
        backgroundColor: tint.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: fonts.bodyMedium,
          fontSize: size * 0.34,
          color: tint.text,
        }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

export default Avatar;
