import { Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { ink, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import type { SentIntro } from "./mockSentIntros";

interface SentIntroRowProps {
  intro: SentIntro;
  index: number;
}

const AVATAR_SIZE = 40;
const AVATAR_OVERLAP = AVATAR_SIZE * 0.22;

// Spaced out slower than the Home feed's card stagger (80ms/250ms duration)
// so the Intros list reads distinctly from the Home screen it shares a
// pattern with.
const ROW_STAGGER_MS = 130;
const ROW_ENTER_DURATION_MS = 300;

function formatSentDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function SentIntroRow({ intro, index }: SentIntroRowProps) {
  const isMatched = intro.status === "matched";
  const rowDelay = index * ROW_STAGGER_MS;

  // The initials-bearing avatar always renders on top: cropping a photo at
  // the overlap reads fine, but cropping initials text does not. If both (or
  // neither) have photos, order doesn't matter, so A stays in back by default.
  const swapOrder = !intro.personAAvatarUri && Boolean(intro.personBAvatarUri);
  const back = swapOrder
    ? { name: intro.personBName, uri: intro.personBAvatarUri, tintIndex: 1 }
    : { name: intro.personAName, uri: intro.personAAvatarUri, tintIndex: 0 };
  const front = swapOrder
    ? { name: intro.personAName, uri: intro.personAAvatarUri, tintIndex: 0 }
    : { name: intro.personBName, uri: intro.personBAvatarUri, tintIndex: 1 };

  return (
    <Animated.View
      entering={FadeInDown.duration(ROW_ENTER_DURATION_MS).delay(rowDelay)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing[4],
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
      <View style={{ flexDirection: "row", width: AVATAR_SIZE * 2 - AVATAR_OVERLAP }}>
        <Animated.View entering={FadeIn.duration(180).delay(rowDelay + 60)}>
          <Avatar name={back.name} size={AVATAR_SIZE} index={back.tintIndex} imageUri={back.uri} />
        </Animated.View>
        <Animated.View
          entering={FadeIn.duration(180).delay(rowDelay + 160)}
          style={{
            marginLeft: -AVATAR_OVERLAP,
            borderRadius: radii.pill,
            borderWidth: 2,
            borderColor: surface.paper,
          }}
        >
          <Avatar name={front.name} size={AVATAR_SIZE} index={front.tintIndex} imageUri={front.uri} />
        </Animated.View>
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.base[0], color: ink[900] }}
          numberOfLines={1}
        >
          {intro.personAName.split(" ")[0]} & {intro.personBName.split(" ")[0]}
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: fontSize.sm[0], color: ink[500] }}>
          Sent {formatSentDate(intro.sentAt)}
        </Text>
      </View>

      {isMatched ? (
        <Animated.View entering={ZoomIn.duration(320).delay(rowDelay + 220).springify().damping(9)}>
          <Badge label="Matched" tone="mint" variant="outline" />
        </Animated.View>
      ) : (
        <Badge label="Pending" tone="butter" variant="outline" textColor={ink[900]} />
      )}
    </Animated.View>
  );
}

export default SentIntroRow;
