import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/ui/Button";
import { SelectedPairHeader } from "../../components/matchmaker/SelectedPairHeader";
import { NoteComposerCard } from "../../components/matchmaker/NoteComposerCard";
import { SendConfirmationOverlay } from "../../components/matchmaker/SendConfirmationOverlay";
import { getMatchmakerFriends } from "../../lib/friendships";
import { sendIntroduction } from "../../lib/introductions";
import { useAuthStore } from "../../store/auth";
import { coral, ink, surface } from "../../constants/colors";
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

/**
 * supabase-js's FunctionsHttpError always has a generic .message ("Edge
 * Function returned a non-2xx status code") — the Edge Function's actual
 * JSON error body is only reachable via .context, a raw Response. Same
 * detection pattern lib/introductions.ts's respondToIntroduction already
 * uses for its 409 check.
 */
async function extractSendErrorMessage(err: unknown): Promise<string> {
  if (err && typeof err === "object" && "context" in err) {
    const context = (err as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json();
        if (typeof body?.error === "string") return body.error;
      } catch {
        // Fall through to the generic message below.
      }
    }
  }
  return err instanceof Error ? err.message : "Couldn't send that intro. Try again.";
}

export default function MatchmakerNoteScreen() {
  const { friendAId, friendBId } = useLocalSearchParams<{ friendAId?: string; friendBId?: string }>();
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const { data: friends = [] } = useQuery({
    queryKey: ["matchmakerFriends", userId],
    queryFn: () => getMatchmakerFriends(userId!),
    enabled: !!userId,
  });

  const friendA = friends.find((f) => f.id === friendAId);
  const friendB = friends.find((f) => f.id === friendBId);

  // Malformed/direct deep link with no matching friends — not reachable via
  // the app's own navigation (select.tsx only ever passes eligible ids), so
  // this just backs out rather than showing a dedicated error state. Gated
  // on friends.length > 0 so this doesn't fire while the query is still
  // loading (friendA/friendB are legitimately undefined until then).
  useEffect(() => {
    if (friends.length > 0 && (!friendA || !friendB)) {
      router.canGoBack() && router.back();
    }
  }, [friends, friendA, friendB]);

  if (!friendA || !friendB) {
    return null;
  }

  const canSend = note.trim().length > 0;

  async function handleSend() {
    if (confirming || sending || !friendA || !friendB || !canSend) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    setSendError(null);
    try {
      await sendIntroduction(friendA.id, friendB.id, note.trim());
      queryClient.invalidateQueries({ queryKey: ["sentIntroductions", userId] });
      setConfirming(true);
    } catch (err) {
      setSendError(await extractSendErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  function handleConfirmationDismiss() {
    setConfirming(false);
    router.dismissTo("/(tabs)" as never);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{
        flex: 1,
        backgroundColor: surface.cream,
        borderTopLeftRadius: radii["2xl"],
        borderTopRightRadius: radii["2xl"],
        overflow: "hidden",
        paddingTop: insets.top,
      }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing[6] }}
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

        <View style={{ paddingHorizontal: spacing[6], paddingTop: spacing[6] }}>
          <NoteComposerCard value={note} onChangeText={setNote} />
        </View>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: spacing[6],
          paddingTop: spacing[4],
          paddingBottom: insets.bottom + spacing[4],
          borderTopWidth: 1,
          borderTopColor: ink[200],
        }}
      >
        {sendError && (
          <Text
            style={[
              textStyles.caption,
              { color: coral[500], textAlign: "center", marginBottom: spacing[2] },
            ]}
          >
            {sendError}
          </Text>
        )}
        <Button
          title="Send intro"
          onPress={handleSend}
          disabled={!canSend || confirming}
          loading={sending}
        />
      </View>

      <SendConfirmationOverlay visible={confirming} onDismiss={handleConfirmationDismiss} />
    </KeyboardAvoidingView>
  );
}
