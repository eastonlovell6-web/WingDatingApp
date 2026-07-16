import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { GroupCard } from "../../components/profile/PrivacyPanel";
import { FriendVisibilityList } from "../../components/onboarding/FriendVisibilityList";
import { coral, ink, surface } from "../../constants/colors";
import { fonts, fontSize, textStyles } from "../../constants/typography";
import { spacing } from "../../constants/spacing";
import { useAuthStore } from "../../store/auth";
import {
  getFriendVisibilityList,
  setAllFriendsCanIntroduce,
  setFriendCanIntroduce,
} from "../../lib/friendships";
import { formatRelativeTime } from "../../lib/format";

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 8 12l7 7" stroke={ink[900]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function friendCaption(createdAt: string, isNew: boolean): string {
  if (isNew) return `Joined ${formatRelativeTime(createdAt)}`;
  const month = new Date(createdAt).toLocaleDateString("en-US", { month: "long" });
  return `Friend since ${month}`;
}

export default function FriendVisibilityScreen() {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const { data: friends, isLoading } = useQuery({
    queryKey: ["friendVisibilityList", userId],
    queryFn: () => getFriendVisibilityList(userId!),
    enabled: !!userId,
  });

  const [visibility, setVisibility] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!friends) return;
    setVisibility(Object.fromEntries(friends.map((f) => [f.id, f.canIntroduce])));
  }, [friends]);

  function invalidateIntroducersCount() {
    if (userId) queryClient.invalidateQueries({ queryKey: ["introducersCount", userId] });
  }

  function handleToggle(friendId: string) {
    const next = !visibility[friendId];
    setVisibility((prev) => ({ ...prev, [friendId]: next }));
    if (!userId) return;
    setFriendCanIntroduce(userId, friendId, next)
      .then(invalidateIntroducersCount)
      .catch((err) => console.error("Failed to update friend visibility:", err));
  }

  function handleSelectAll() {
    if (!friends || friends.length === 0) return;
    setVisibility(Object.fromEntries(friends.map((f) => [f.id, true])));
    if (!userId) return;
    setAllFriendsCanIntroduce(
      userId,
      friends.map((f) => f.id),
      true
    )
      .then(invalidateIntroducersCount)
      .catch((err) => console.error("Failed to update friend visibility:", err));
  }

  function handleSelectNone() {
    if (!friends || friends.length === 0) return;
    setVisibility(Object.fromEntries(friends.map((f) => [f.id, false])));
    if (!userId) return;
    setAllFriendsCanIntroduce(
      userId,
      friends.map((f) => f.id),
      false
    )
      .then(invalidateIntroducersCount)
      .catch((err) => console.error("Failed to update friend visibility:", err));
  }

  const listItems = (friends ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    isNew: f.isNew,
    caption: friendCaption(f.createdAt, f.isNew),
  }));

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      <View
        style={{
          paddingTop: insets.top + spacing[2],
          paddingBottom: spacing[2],
          paddingHorizontal: spacing[4],
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
      </View>

      <View style={{ paddingHorizontal: spacing[6], gap: spacing[2], marginBottom: spacing[6] }}>
        <Text style={textStyles.heading}>Friend visibility</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: fontSize.base[0], color: ink[500] }}>
          Choose who can introduce you
        </Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: spacing[6], paddingBottom: insets.bottom + spacing[8] }}>
        {isLoading && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={coral[500]} />
          </View>
        )}

        {!isLoading && listItems.length === 0 && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing[6] }}>
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: fontSize.base[0],
                color: ink[500],
                textAlign: "center",
              }}
            >
              You don&apos;t have any friends on Wing yet.
            </Text>
          </View>
        )}

        {!isLoading && listItems.length > 0 && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing[8] }}>
            <GroupCard>
              <View style={{ padding: spacing[4] }}>
                <FriendVisibilityList
                  friends={listItems}
                  visibility={visibility}
                  onToggle={handleToggle}
                  onSelectAll={handleSelectAll}
                  onSelectNone={handleSelectNone}
                />
              </View>
            </GroupCard>
          </ScrollView>
        )}
      </View>
    </View>
  );
}
