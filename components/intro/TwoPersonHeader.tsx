import { Text, View } from "react-native";
import { Avatar } from "../ui/Avatar";
import { TruncatedText } from "../ui/TruncatedText";
import { ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

interface PersonHeaderInfo {
  name: string;
  age: number;
  tagline: string;
  photoUri?: string;
}

interface TwoPersonHeaderProps {
  self: PersonHeaderInfo;
  match: PersonHeaderInfo;
}

// Kept compact (a nameplate strip, not a second hero visual) so the intro
// note below stays the screen's one clear focal point.
function PersonColumn({ person, index }: { person: PersonHeaderInfo; index: number }) {
  const firstName = person.name.split(" ")[0];

  return (
    <View style={{ flex: 1, alignItems: "stretch", gap: spacing[2] }}>
      <View style={{ alignItems: "center" }}>
        <Avatar name={person.name} imageUri={person.photoUri} size={88} index={index} />
      </View>
      <Text
        style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.lg[0], color: ink[900], textAlign: "center" }}
      >
        {firstName}, {person.age}
      </Text>
      <TruncatedText
        numberOfLines={1}
        style={{
          width: "100%",
          fontFamily: fonts.body,
          fontSize: fontSize.sm[0],
          lineHeight: fontSize.sm[1],
          color: ink[500],
          textAlign: "center",
        }}
      >
        {person.tagline}
      </TruncatedText>
    </View>
  );
}

/** Side-by-side "you + them" header for the Intro Detail screen. */
export function TwoPersonHeader({ self, match }: TwoPersonHeaderProps) {
  return (
    <View style={{ flexDirection: "row", gap: spacing[4] }}>
      <PersonColumn person={self} index={0} />
      <PersonColumn person={match} index={1} />
    </View>
  );
}

export default TwoPersonHeader;
