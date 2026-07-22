import { Pressable, ScrollView, Share, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { InviteCodeRow } from "../../components/invite/InviteCodeRow";
import { getInviteSlots, markInviteSent, type InviteSlot } from "../../lib/invites";
import { useAuthStore } from "../../store/auth";
import { ink, surface } from "../../constants/colors";
import { fonts, fontSize, textStyles } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 8 12l7 7" stroke={ink[900]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function InviteScreen() {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const queryKey = ["inviteSlots", userId];

  const { data: slots = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => getInviteSlots(userId!),
    enabled: !!userId,
  });

  const remaining = slots.filter((slot) => slot.status === "unsent").length;

  async function handleShare(slot: InviteSlot) {
    try {
      // Android's Share.share() always resolves with sharedAction —
      // dismissedAction only ever fires on iOS.
      const result = await Share.share({
        message: `Join me on Wing — use my invite code: ${slot.code}`,
      });
      if (result.action === Share.sharedAction) {
        await markInviteSent(slot.id);
        queryClient.invalidateQueries({ queryKey });
      }
    } catch (err) {
      console.warn("Invite share failed", err);
    }
  }

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
        <View style={{ gap: spacing[2] }}>
          <Text
            style={{
              fontFamily: fonts.displaySemibold,
              fontSize: fontSize["2xl"][0],
              lineHeight: fontSize["2xl"][1],
              color: ink[900],
            }}
          >
            Invite Friends
          </Text>
          {!isLoading && (
            <Text style={[textStyles.eyebrow, remaining === 0 && { color: ink[500] }]}>
              {remaining > 0 ? `You have ${remaining} of 5 invites left` : "All invites sent"}
            </Text>
          )}
        </View>

        {isLoading ? (
          <Text style={{ fontFamily: fonts.body, fontSize: fontSize.base[0], color: ink[500] }}>
            Loading...
          </Text>
        ) : (
          <View style={{ gap: spacing[2] }}>
            {slots.map((slot) => (
              <InviteCodeRow
                key={slot.id}
                code={slot.code}
                status={slot.status}
                onShare={() => handleShare(slot)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
