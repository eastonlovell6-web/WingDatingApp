import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "../../components/ui/Avatar";
import { getIntroducibleFriends } from "../../components/matchmaker/mockMatchmakerFriends";
import { sortFriendsByPromptMatch } from "../../lib/promptMatch";
import { getTodaysPrompt } from "../../lib/prompts";
import { ink, surface } from "../../constants/colors";
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

export default function PromptFriendsScreen() {
  const insets = useSafeAreaInsets();
  const prompt = getTodaysPrompt();
  const friends = sortFriendsByPromptMatch(getIntroducibleFriends(), prompt.keywords);

  function handleSelect(friendId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/matchmaker/select?preselect=${friendId}` as never);
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
          accessibilityLabel="Close"
        >
          <XIcon />
        </Pressable>
        <Text style={textStyles.eyebrow}>TODAY'S PROMPT</Text>
      </View>

      <View style={{ paddingHorizontal: spacing[6], paddingTop: spacing[6], gap: spacing[2] }}>
        <Text style={textStyles.heading}>{prompt.text}</Text>
        <Text style={textStyles.caption}>Tap a friend to start their intro.</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing[6],
          paddingTop: spacing[6],
          paddingBottom: insets.bottom + spacing[6],
          gap: spacing[4],
        }}
        showsVerticalScrollIndicator={false}
      >
        {friends.map((friend, index) => (
          <Pressable key={friend.id} onPress={() => handleSelect(friend.id)}>
            {({ pressed }) => (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[4],
                  padding: spacing[4],
                  borderRadius: radii.md,
                  backgroundColor: surface.paper,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                }}
              >
                <Avatar name={friend.name} size={48} index={index} imageUri={friend.imageUri} />
                <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.base[0], color: ink[900] }}>
                  {friend.name}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
