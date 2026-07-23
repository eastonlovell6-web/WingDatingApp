// components/intro/WaitingIntroCard.tsx
import { Text, View } from "react-native";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { ink, plum, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { elevation } from "../../constants/elevation";
import type { WaitingIntro } from "./mockIntros";

interface WaitingIntroCardProps {
  intro: WaitingIntro;
}

function formatWaitingLabel(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function WaitingIntroCard({ intro }: WaitingIntroCardProps) {
  const waitingLabel = formatWaitingLabel(intro.createdAt);

  return (
    <View
      accessible
      accessibilityLabel={`Waiting on ${intro.matchAvatarName}, ${intro.matchmakerName}'s intro, ${waitingLabel}`}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing[4],
          backgroundColor: surface.paper,
          borderRadius: radii.md,
          padding: spacing[4],
        },
        elevation.xs,
      ]}
    >
      <View style={{ borderRadius: radii.pill, borderWidth: 1.5, borderColor: plum[100], padding: 2 }}>
        <Avatar name={intro.matchAvatarName} size={40} imageUri={intro.matchAvatarUri} />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.base[0], color: ink[900] }}
          numberOfLines={1}
        >
          Waiting on {intro.matchAvatarName}
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: fontSize.sm[0], color: ink[500] }}>
          {intro.matchmakerName}&rsquo;s intro &middot; {waitingLabel}
        </Text>
      </View>

      <Badge label="Pending" tone="butter" variant="outline" textColor={ink[900]} />
    </View>
  );
}

export default WaitingIntroCard;
