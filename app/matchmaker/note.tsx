import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Button } from "../../components/ui/Button";
import { SelectedPairHeader } from "../../components/matchmaker/SelectedPairHeader";
import { NoteComposerCard } from "../../components/matchmaker/NoteComposerCard";
import { SendConfirmationOverlay } from "../../components/matchmaker/SendConfirmationOverlay";
import { MOCK_MATCHMAKER_FRIENDS } from "../../components/matchmaker/mockMatchmakerFriends";
import { MOCK_PROFILE_USER } from "../../components/profile/mockProfile";
import { useIntrosStore } from "../../store/intros";
import { formatIntroNotification } from "../../lib/notifications";
import { ink, surface } from "../../constants/colors";
import { textStyles } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";

function XIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6l12 12M18 6 6 18"
        stroke={ink[900]}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function MatchmakerNoteScreen() {
  const { friendAId, friendBId } = useLocalSearchParams<{ friendAId?: string; friendBId?: string }>();
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);

  const friendA = MOCK_MATCHMAKER_FRIENDS.find((f) => f.id === friendAId);
  const friendB = MOCK_MATCHMAKER_FRIENDS.find((f) => f.id === friendBId);

  // Malformed/direct deep link with no matching friends — not reachable via
  // the app's own navigation (select.tsx only ever passes eligible ids), so
  // this just backs out rather than showing a dedicated error state.
  useEffect(() => {
    if (!friendA || !friendB) {
      router.canGoBack() && router.back();
    }
  }, [friendA, friendB]);

  if (!friendA || !friendB) {
    return null;
  }

  const canSend = note.trim().length > 0;

  async function handleSend() {
    if (confirming || !friendA || !friendB || !canSend) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    useIntrosStore.getState().sendIntro(friendA, friendB, note.trim());

    const { status } = await Notifications.getPermissionsAsync();
    let granted = status === "granted";
    if (!granted && status !== "denied") {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.status === "granted";
    }
    if (granted) {
      const matchmakerFirstName = MOCK_PROFILE_USER.name.split(" ")[0];
      await Notifications.scheduleNotificationAsync({
        content: formatIntroNotification(matchmakerFirstName),
        trigger: null,
      });
    }

    setConfirming(true);
  }

  function handleConfirmationDismiss() {
    setConfirming(false);
    router.dismissTo("/(tabs)" as never);
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: surface.cream,
        borderTopLeftRadius: radii["2xl"],
        borderTopRightRadius: radii["2xl"],
        overflow: "hidden",
        paddingTop: insets.top,
      }}
    >
      <View style={{ alignItems: "center", paddingTop: spacing[2] }}>
        <View style={{ width: 40, height: 5, borderRadius: radii.pill, backgroundColor: ink[300] }} />
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing[6],
          paddingTop: spacing[4],
        }}
      >
        <Pressable
          onPress={() => router.canGoBack() && router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <XIcon />
        </Pressable>
        <Text style={textStyles.eyebrow}>STEP 2 OF 2</Text>
      </View>

      <View style={{ paddingHorizontal: spacing[6], paddingTop: spacing[6], gap: spacing[2] }}>
        <Text style={textStyles.heading}>Write the intro</Text>
        <Text style={textStyles.caption}>A short note goes a long way.</Text>
      </View>

      <View style={{ paddingHorizontal: spacing[6], paddingTop: spacing[6] }}>
        <SelectedPairHeader friendA={friendA} friendB={friendB} />
      </View>

      <View style={{ flex: 1, paddingHorizontal: spacing[6], paddingTop: spacing[6] }}>
        <NoteComposerCard value={note} onChangeText={setNote} />
      </View>

      <View
        style={{
          paddingHorizontal: spacing[6],
          paddingTop: spacing[4],
          paddingBottom: insets.bottom + spacing[4],
          borderTopWidth: 1,
          borderTopColor: ink[200],
        }}
      >
        <Button title="Send intro" onPress={handleSend} disabled={!canSend || confirming} />
      </View>

      <SendConfirmationOverlay visible={confirming} onDismiss={handleConfirmationDismiss} />
    </View>
  );
}
