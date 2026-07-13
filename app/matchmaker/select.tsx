import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { FriendPickerGrid } from "../../components/matchmaker/FriendPickerGrid";
import { MatchmakerEncouragementState } from "../../components/matchmaker/MatchmakerEncouragementState";
import {
  MOCK_MATCHMAKER_FRIENDS,
  getFriendEligibility,
} from "../../components/matchmaker/mockMatchmakerFriends";
import { ink, surface } from "../../constants/colors";
import { textStyles } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";

const spring = { mass: 0.4, damping: 12, stiffness: 220 };

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

export default function MatchmakerSelectScreen() {
  const { preselect } = useLocalSearchParams<{ preselect?: string }>();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (!preselect) return [];
    const preselectedFriend = MOCK_MATCHMAKER_FRIENDS.find((f) => f.id === preselect);
    if (!preselectedFriend || getFriendEligibility(preselectedFriend) !== "eligible") return [];
    return [preselect];
  });

  const eligibleCount = MOCK_MATCHMAKER_FRIENDS.filter(
    (f) => getFriendEligibility(f) === "eligible"
  ).length;
  const showEncouragement = eligibleCount < 2;

  const filteredFriends = MOCK_MATCHMAKER_FRIENDS.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedFriends = selectedIds.map(
    (id) => MOCK_MATCHMAKER_FRIENDS.find((f) => f.id === id)!
  );
  const canContinue = selectedIds.length === 2;

  const buttonScale = useSharedValue(1);
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  useEffect(() => {
    if (canContinue) {
      buttonScale.value = withSequence(withSpring(1.06, spring), withSpring(1, spring));
    }
  }, [canContinue, buttonScale]);

  function handleToggle(friendId: string) {
    setSelectedIds((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  }

  function handleContinue() {
    if (!canContinue) return;
    router.push(
      `/matchmaker/note?friendAId=${selectedIds[0]}&friendBId=${selectedIds[1]}` as never
    );
  }

  function handleInvitePress() {
    // TODO: hand off to the Invite flow once it exists (same stub convention
    // as FriendsRow.handleFriendPress / HomeHeader's unwired onInvitePress).
    console.log("[matchmaker/select] invite friends tapped");
  }

  const headline = selectedIds.length === 0 ? "Who should meet?" : "Nice. Who's their match?";
  const continueLabel = canContinue
    ? `Continue with ${selectedFriends[0].name.split(" ")[0]} & ${selectedFriends[1].name.split(" ")[0]}`
    : "Continue";

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
          accessibilityLabel="Close"
        >
          <XIcon />
        </Pressable>
        <Text style={textStyles.eyebrow}>STEP 1 OF 2</Text>
      </View>

      {showEncouragement ? (
        <MatchmakerEncouragementState
          onInvitePress={handleInvitePress}
          onNotNowPress={() => router.canGoBack() && router.back()}
        />
      ) : (
        <>
          <View style={{ paddingHorizontal: spacing[6], paddingTop: spacing[6], gap: spacing[2] }}>
            <Text style={textStyles.heading}>{headline}</Text>
            <Text style={textStyles.caption}>Pick two friends you think would click.</Text>
          </View>

          <View style={{ paddingHorizontal: spacing[6], paddingTop: spacing[6] }}>
            <Input
              placeholder="Search friends"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: spacing[6],
              paddingTop: spacing[6],
              paddingBottom: spacing[4],
            }}
            showsVerticalScrollIndicator={false}
          >
            <FriendPickerGrid friends={filteredFriends} selectedIds={selectedIds} onToggle={handleToggle} />
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
            <Animated.View style={buttonAnimatedStyle}>
              <Button title={continueLabel} onPress={handleContinue} disabled={!canContinue} />
            </Animated.View>
          </View>
        </>
      )}
    </View>
  );
}
