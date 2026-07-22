import { Text, View } from "react-native";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { coral, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";

interface InviteCodeRowProps {
  code: string;
  status: "unsent" | "sent";
  onShare: () => void;
}

export function InviteCodeRow({ code, status, onShare }: InviteCodeRowProps) {
  const isSent = status === "sent";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: surface.paper,
        borderRadius: radii.md,
        padding: spacing[4],
        shadowColor: shadowTint,
        shadowOpacity: 1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: fontSize.base[0],
          lineHeight: fontSize.base[1],
          color: coral[600],
        }}
      >
        {code}
      </Text>

      {isSent ? (
        <Badge label="Sent" tone="plum" />
      ) : (
        <Button
          title="Share"
          variant="primary"
          onPress={onShare}
          style={{ height: 44, paddingHorizontal: 20 }}
        />
      )}
    </View>
  );
}

export default InviteCodeRow;
