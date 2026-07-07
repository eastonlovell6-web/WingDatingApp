import { Text, View } from "react-native";
import { Button } from "../ui/Button";
import { WingMark } from "../ui/WingMark";
import { coral, ink, plum } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";

interface HomeHeaderProps {
  name?: string;
  onInvitePress?: () => void;
}

export function HomeHeader({ name, onInvitePress }: HomeHeaderProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <WingMark size={20} color={coral[500]} />
        <Text
          style={{
            fontFamily: fonts.displaySemibold,
            fontSize: fontSize.xl[0],
            lineHeight: fontSize.xl[1],
            color: ink[900],
          }}
        >
          Hey {name ?? "there"}
        </Text>
      </View>

      <Button
        title="Invite"
        variant="outline"
        onPress={onInvitePress}
        style={{ height: 40, paddingHorizontal: 16, borderColor: plum[100] }}
      />
    </View>
  );
}

export default HomeHeader;
