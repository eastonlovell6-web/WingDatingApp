import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Svg, { Path } from "react-native-svg";
import { Button } from "../../components/ui/Button";
import { FriendProfileHeader } from "../../components/friend/FriendProfileHeader";
import { FriendPhotoPromptPanel } from "../../components/friend/FriendPhotoPromptPanel";
import { ink, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";
import { useAuthStore } from "../../store/auth";
import { getUserProfile } from "../../lib/supabase";
import { getFriendProfile } from "../../lib/friendships";

// `users` has no age/location columns yet (same gap noted for matchAge/
// matchTagline in app/intro/[id].tsx) — hardcoded since launch is single-
// campus (see CLAUDE.md Launch Context) rather than faked per friend.
const FRIEND_META = "BYU · Provo, UT";

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 8 12l7 7" stroke={ink[900]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Same stub convention as components/profile/mockProfile.ts's comingSoon()
// helper in app/(tabs)/profile.tsx — used here until the Connections List
// screen (spec section 2b) is built in a later plan.
function comingSoon(title: string) {
  Alert.alert(title, "This screen isn't built yet — hang tight.");
}

export default function FriendProfileScreen() {
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const insets = useSafeAreaInsets();
  const { data: friend, isLoading: isFriendLoading } = useQuery({
    queryKey: ["friendProfile", friendId],
    queryFn: () => getFriendProfile(friendId!),
    enabled: !!friendId,
  });
  const userId = useAuthStore((s) => s.user?.id);
  const { data: viewerProfile } = useQuery({
    queryKey: ["userProfile", userId],
    queryFn: () => getUserProfile(userId!),
    enabled: !!userId,
  });
  // Wingman-only viewers do the introducing and are never introduced
  // themselves, so the reverse-connections action doesn't apply to them.
  const isWingmanOnly = viewerProfile?.role === "wing-somebody";

  if (!friend) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: surface.cream,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing[6],
        }}
      >
        {!isFriendLoading && (
          <Text style={{ fontFamily: fonts.body, fontSize: fontSize.base[0], color: ink[500] }}>
            Couldn&apos;t find that friend.
          </Text>
        )}
      </View>
    );
  }

  const firstName = friend.name.split(" ")[0];

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

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing[6],
          paddingTop: spacing[2],
          paddingBottom: insets.bottom + spacing[8],
          gap: spacing[6],
        }}
        showsVerticalScrollIndicator={false}
      >
        <FriendProfileHeader
          name={friend.name}
          meta={FRIEND_META}
          avatarUri={friend.photos[0]}
          lookingToGetSetUp={friend.lookingToGetSetUp}
        />
        <FriendPhotoPromptPanel photos={friend.photos} prompts={friend.prompts} />

        <View style={{ gap: spacing[4] }}>
          {friend.lookingToGetSetUp && (
            <Button
              title={`Introduce ${firstName} to someone`}
              onPress={() => router.push(`/matchmaker/select?preselect=${friend.id}` as never)}
            />
          )}
          {!isWingmanOnly && (
            <Button
              title={`See who ${firstName} could introduce you to`}
              variant="secondary"
              onPress={() => comingSoon(`${firstName}'s connections`)}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}
