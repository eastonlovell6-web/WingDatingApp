import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { IntroNoteCard } from "../intro/IntroNoteCard";
import { blush, coral, ink, mint, plum, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import type { SentIntro } from "./mockSentIntros";

interface SentIntroRowProps {
  intro: SentIntro;
  index: number;
  onNudge?: (intro: SentIntro) => void;
  onWithdraw?: (intro: SentIntro) => void;
}

const AVATAR_SIZE = 40;
const AVATAR_OVERLAP = AVATAR_SIZE * 0.22;

// Spaced out slower than the Home feed's card stagger (80ms/250ms duration)
// so the Intros list reads distinctly from the Home screen it shares a
// pattern with.
const ROW_STAGGER_MS = 130;
const ROW_ENTER_DURATION_MS = 300;

const cardSpring = { mass: 0.4, damping: 12, stiffness: 220 };
const expandSpring = LinearTransition.springify().mass(0.5).damping(16).stiffness(200);

function formatSentDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function InlineAction({
  label,
  bg,
  textColor,
  onPress,
}: {
  label: string;
  bg: string;
  textColor: string;
  onPress?: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPressIn={() => (scale.value = withSpring(0.97, cardSpring))}
      onPressOut={() => (scale.value = withSpring(1, cardSpring))}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={[
          {
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: spacing[2] + 2,
            borderRadius: radii.pill,
            backgroundColor: bg,
          },
          animatedStyle,
        ]}
      >
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.sm[0], color: textColor }}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function SentIntroRow({ intro, index, onNudge, onWithdraw }: SentIntroRowProps) {
  const isMatched = intro.status === "matched";
  const rowDelay = index * ROW_STAGGER_MS;
  const [expanded, setExpanded] = useState(false);

  const scale = useSharedValue(1);
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

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

  const namesLabel = `Your note to ${intro.personAName.split(" ")[0]} & ${intro.personBName.split(" ")[0]}`;

  const cardContent = (
    <Animated.View
      layout={expandSpring}
      style={[
        {
          backgroundColor: surface.paper,
          borderRadius: radii.md,
          padding: spacing[4],
          shadowColor: shadowTint,
          shadowOpacity: 1,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
        },
        !isMatched && cardAnimatedStyle,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[4] }}>
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
          <Animated.View entering={FadeIn.duration(220).delay(rowDelay + 220)}>
            <Badge label="Matched" tone="mint" variant="outline" textColor={mint[700]} />
          </Animated.View>
        ) : (
          <Badge label="Pending" tone="butter" variant="outline" textColor={ink[900]} />
        )}
      </View>

      {expanded && (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(120)}
          style={{ marginTop: spacing[4], gap: spacing[4] }}
        >
          <IntroNoteCard note={intro.note} eyebrow={namesLabel} />
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            <InlineAction
              label="Nudge"
              bg={plum[100]}
              textColor={plum[600]}
              onPress={() => onNudge?.(intro)}
            />
            <InlineAction
              label="Withdraw"
              bg={blush[100]}
              textColor={coral[700]}
              onPress={() => onWithdraw?.(intro)}
            />
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );

  // Matched rows are never expandable — nothing to check on post-match, and
  // this keeps the matchmaker firewall intact (no post-send chat/status
  // visibility, matched or not).
  if (isMatched) {
    return (
      <Animated.View entering={FadeInDown.duration(ROW_ENTER_DURATION_MS).delay(rowDelay)}>
        {cardContent}
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(ROW_ENTER_DURATION_MS).delay(rowDelay)} layout={expandSpring}>
      <Pressable
        onPressIn={() => (scale.value = withSpring(0.98, cardSpring))}
        onPressOut={() => (scale.value = withSpring(1, cardSpring))}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${namesLabel}, pending. Tap to ${expanded ? "collapse" : "expand"}.`}
      >
        {cardContent}
      </Pressable>
    </Animated.View>
  );
}

export default SentIntroRow;
