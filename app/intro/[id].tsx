import { Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Svg, { Path } from "react-native-svg";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from "react-native-reanimated";
import { MatchmakerChip } from "../../components/intro/MatchmakerChip";
import { TwoPersonHeader } from "../../components/intro/TwoPersonHeader";
import { IntroNoteCard } from "../../components/intro/IntroNoteCard";
import { AboutSection } from "../../components/intro/AboutSection";
import { Button } from "../../components/ui/Button";
import { SendConfirmationOverlay } from "../../components/matchmaker/SendConfirmationOverlay";
import { MOCK_PHOTOS, MOCK_PROFILE_USER } from "../../components/profile/mockProfile";
import { useAuthStore } from "../../store/auth";
import { extractFunctionErrorMessage, getIntroductionDetail, respondToIntroduction } from "../../lib/introductions";
import { getUserProfile } from "../../lib/supabase";
import { coral, ink, surface } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 8 12l7 7" stroke={ink[900]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const spring = { mass: 0.4, damping: 12, stiffness: 220 };

// Deliberately lighter than the Button component's variants — Snooze is the
// least-common of the three actions, so it reads as plain text with no
// fill/border rather than competing with Skip or Accept for visual weight.
function SnoozeButton({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }

  return (
    <Pressable
      onPressIn={() => (scale.value = withSpring(0.97, spring))}
      onPressOut={() => (scale.value = withSpring(1, spring))}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Snooze"
    >
      <Animated.View style={[{ height: 60, alignItems: "center", justifyContent: "center" }, animatedStyle]}>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 17, letterSpacing: 0.2, color: ink[500] }}>
          Snooze
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function IntroDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["userProfile", userId],
    queryFn: () => getUserProfile(userId!),
    enabled: !!userId,
  });
  const { data: intro, isLoading: isIntroLoading } = useQuery({
    queryKey: ["introDetail", id, userId],
    queryFn: () => getIntroductionDetail(id!, userId!),
    enabled: !!id && !!userId,
  });

  const introId = intro?.id;
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [matched, setMatched] = useState(false);

  function invalidateIntroLists() {
    if (!userId) return;
    queryClient.invalidateQueries({ queryKey: ["incomingIntros", userId] });
    queryClient.invalidateQueries({ queryKey: ["waitingOnThemIntros", userId] });
  }

  const acceptScale = useSharedValue(1);
  const acceptAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: acceptScale.value }],
  }));

  const selfName = profile?.name ?? MOCK_PROFILE_USER.name;
  const selfPhoto = profile?.photos?.[0] ?? MOCK_PHOTOS[0];

  // Skip and Snooze both fire immediately — no confirmation step for either.
  // Silent rejection is the design: nothing here ever reveals to the
  // matchmaker or the other person that a pass happened.
  function handleSkip() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (introId) {
      respondToIntroduction(introId, "pass")
        .then(invalidateIntroLists)
        .catch((err) => console.warn("failed to record pass", err));
    }
    if (router.canGoBack()) router.back();
  }

  // TODO: no "snoozed" status exists on `introductions` yet — this just
  // pops back like Skip. Once resurface-in-a-few-days logic has somewhere to
  // persist to, wire this to that instead of a plain log.
  function handleSnooze() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log(`[intro:${introId}] snoozed`);
    if (router.canGoBack()) router.back();
  }

  async function handleAccept() {
    if (!introId || accepting) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      const result = await respondToIntroduction(introId, "accept");
      invalidateIntroLists();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      acceptScale.value = withSequence(withSpring(1.06, spring), withSpring(1, spring));
      setMatched(result === "accepted");
      setConfirming(true);
    } catch (err) {
      setAccepting(false);
      setAcceptError(await extractFunctionErrorMessage(err, "Couldn't accept that intro. Try again."));
    }
  }

  function handleAcceptConfirmationDismiss() {
    setConfirming(false);
    if (router.canGoBack()) router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing[4],
          paddingTop: insets.top + spacing[2],
          paddingHorizontal: spacing[6],
          paddingBottom: spacing[4],
        }}
      >
        <Pressable
          onPress={() => router.canGoBack() && router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <BackIcon />
        </Pressable>
        {intro && <MatchmakerChip name={intro.matchmakerName} avatarUri={intro.matchmakerAvatarUri} />}
      </View>

      {!intro ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing[6] }}>
          {!isIntroLoading && (
            <Text style={{ fontFamily: fonts.body, color: ink[500] }}>This intro isn't available anymore.</Text>
          )}
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: spacing[6], paddingBottom: spacing[8], gap: spacing[8] }}
            showsVerticalScrollIndicator={false}
          >
            <TwoPersonHeader
              self={{ name: selfName, age: MOCK_PROFILE_USER.age, tagline: MOCK_PROFILE_USER.tagline, photoUri: selfPhoto }}
              match={{
                name: intro.matchAvatarName,
                age: intro.matchAge,
                tagline: intro.matchTagline,
                photoUri: intro.matchAvatarUri,
              }}
            />

            <IntroNoteCard matchmakerName={intro.matchmakerName} note={intro.note} />

            <AboutSection name={intro.matchAvatarName} photos={intro.matchPhotos} prompts={intro.matchPrompts} />
          </ScrollView>

          <View
            style={{
              gap: spacing[2],
              paddingHorizontal: spacing[6],
              paddingTop: spacing[4],
              paddingBottom: insets.bottom + spacing[4],
              borderTopWidth: 1,
              borderTopColor: ink[200],
              backgroundColor: surface.cream,
            }}
          >
            {acceptError && (
              <Text style={{ fontFamily: fonts.body, fontSize: 14, color: coral[500], textAlign: "center" }}>
                {acceptError}
              </Text>
            )}
            <View style={{ flexDirection: "row", gap: spacing[2] }}>
              <View style={{ flex: 1 }}>
                <Button title="Skip" variant="outline" onPress={handleSkip} disabled={accepting} />
              </View>
              <View style={{ flex: 1 }}>
                <SnoozeButton onPress={handleSnooze} />
              </View>
            </View>
            <Animated.View style={acceptAnimatedStyle}>
              <Button title="Accept intro" variant="primary" onPress={handleAccept} loading={accepting} />
            </Animated.View>
          </View>
        </>
      )}
      <SendConfirmationOverlay
        visible={confirming}
        onDismiss={handleAcceptConfirmationDismiss}
        message={matched ? "You're both in — say hi!" : "You're in — we'll let you know if they say yes too"}
      />
    </View>
  );
}
