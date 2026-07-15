import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { SendConfirmationOverlay } from "../../components/matchmaker/SendConfirmationOverlay";
import { getDiscoverPersonDetail } from "../../lib/discover";
import type { WingFriend } from "../../components/home/friendsMock";
import { extractFunctionErrorMessage, requestIntroduction } from "../../lib/introductions";
import { coral, ink, surface } from "../../constants/colors";
import { fonts, fontSize, textStyles } from "../../constants/typography";
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

function MutualOption({
  friend,
  selected,
  onPress,
}: {
  friend: WingFriend;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={friend.name}
      accessibilityState={{ selected }}
    >
      <View style={{ alignItems: "center", gap: 6 }}>
        <View style={{ width: 60, height: 60, alignItems: "center", justifyContent: "center" }}>
          {selected && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 58,
                height: 58,
                borderRadius: radii.pill,
                borderWidth: 2.5,
                borderColor: coral[500],
              }}
            />
          )}
          <Avatar name={friend.name} size={52} imageUri={friend.imageUri} />
        </View>
        <Text style={{ fontFamily: fonts.body, fontSize: fontSize.sm[0], color: ink[900] }}>
          {friend.name.split(" ")[0]}
        </Text>
      </View>
    </Pressable>
  );
}

export default function RequestIntroScreen() {
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const insets = useSafeAreaInsets();
  const [selectedMutualId, setSelectedMutualId] = useState<string | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const { data: person, isLoading } = useQuery({
    queryKey: ["discoverPerson", friendId],
    queryFn: () => getDiscoverPersonDetail(friendId!),
    enabled: !!friendId,
  });
  const mutuals: WingFriend[] = person?.mutuals ?? [];

  // Malformed/direct deep link, or a target that's fallen out of the 2-hop
  // network since navigation (e.g. a friendship was removed) — not
  // otherwise reachable via the app's own navigation, so this just backs
  // out rather than showing a dedicated error state. Same convention as
  // matchmaker/note.tsx.
  useEffect(() => {
    if (!isLoading && (!person || mutuals.length === 0)) {
      router.canGoBack() && router.back();
    }
  }, [isLoading, person, mutuals.length]);

  useEffect(() => {
    if (mutuals.length > 0 && !selectedMutualId) {
      setSelectedMutualId(mutuals[0].id);
    }
  }, [mutuals, selectedMutualId]);

  if (!person || mutuals.length === 0) {
    return null;
  }

  const selectedMutual = mutuals.find((m) => m.id === selectedMutualId) ?? mutuals[0];
  const targetFirstName = person.name.split(" ")[0];
  const mutualFirstName = selectedMutual.name.split(" ")[0];

  async function handleSend() {
    if (sending || confirming || !person || mutuals.length === 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    setSendError(null);
    try {
      await requestIntroduction(person.id, selectedMutual.id);
      setConfirming(true);
    } catch (err) {
      setSendError(await extractFunctionErrorMessage(err, "Couldn't send that request. Try again."));
    } finally {
      setSending(false);
    }
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing[6] }}>
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
            accessibilityLabel="Close"
          >
            <XIcon />
          </Pressable>
          <Text style={textStyles.eyebrow}>REQUEST AN INTRO</Text>
        </View>

        <View
          style={{
            alignItems: "center",
            paddingHorizontal: spacing[6],
            paddingTop: spacing[6],
            gap: spacing[4],
          }}
        >
          <View style={{ width: 120, height: 120, borderRadius: radii.pill, overflow: "hidden" }}>
            <Image source={{ uri: person.photos[0] }} style={{ width: "100%", height: "100%" }} />
          </View>
          <View style={{ alignItems: "center", gap: 2 }}>
            <Text style={textStyles.heading}>{person.name}</Text>
            <Text style={textStyles.caption}>{person.meta}</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing[6], paddingTop: spacing[8], gap: spacing[4] }}>
          <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.sm[0], color: ink[500] }}>
            {mutuals.length === 1 ? "Through your mutual friend" : "Ask through"}
          </Text>
          <View style={{ flexDirection: "row", gap: spacing[4] }}>
            {mutuals.map((friend) => (
              <MutualOption
                key={friend.id}
                friend={friend}
                selected={friend.id === selectedMutual.id}
                onPress={() => setSelectedMutualId(friend.id)}
              />
            ))}
          </View>
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
            style={[textStyles.caption, { color: coral[500], textAlign: "center", marginBottom: spacing[2] }]}
          >
            {sendError}
          </Text>
        )}
        <Button
          title={`Ask ${mutualFirstName} to introduce you to ${targetFirstName}`}
          onPress={handleSend}
          disabled={confirming}
          loading={sending}
        />
      </View>

      <SendConfirmationOverlay
        visible={confirming}
        onDismiss={handleConfirmationDismiss}
        message="Your request is on its way"
      />
    </View>
  );
}
