import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { ProfileHeader } from "../../components/profile/ProfileHeader";
import { ProfileSegmentedControl } from "../../components/profile/ProfileSegmentedControl";
import { PhotoPromptPanel } from "../../components/profile/PhotoPromptPanel";
import { MatchmakerPanel } from "../../components/profile/MatchmakerPanel";
import { PrivacyPanel } from "../../components/profile/PrivacyPanel";
import { TAB_BAR_CLEARANCE } from "../../components/home/TabBar";
import { surface } from "../../constants/colors";
import { spacing } from "../../constants/spacing";
import {
  MOCK_BADGES,
  MOCK_BLOCKED_COUNT,
  MOCK_HAS_SENT_INTROS,
  MOCK_INTRODUCERS_COUNT,
  MOCK_MATCHMAKER_STATS,
  MOCK_PHOTOS,
  MOCK_PRIVACY_SETTINGS,
  MOCK_PROFILE_USER,
  MOCK_PROMPTS,
} from "../../components/profile/mockProfile";
import type { PrivacySettings } from "../../components/profile/mockProfile";

const SEGMENTS = ["Profile", "Matchmaker", "Privacy"];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  // TODO: replace with a real privacy-settings store once that table exists.
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(MOCK_PRIVACY_SETTINGS);

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      <View
        style={{
          paddingTop: insets.top + spacing[4],
          paddingHorizontal: spacing[6],
          paddingBottom: spacing[4],
          gap: spacing[6],
        }}
      >
        <ProfileHeader
          name={MOCK_PROFILE_USER.name}
          meta={MOCK_PROFILE_USER.meta}
          avatarUri={MOCK_PROFILE_USER.avatarUri}
          onEditPress={() => {
            // TODO: router.push('/profile/edit') once that screen exists.
          }}
        />
        <ProfileSegmentedControl segments={SEGMENTS} activeIndex={activeIndex} onChange={setActiveIndex} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing[6],
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE + spacing[12],
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View key={activeIndex} entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
          {activeIndex === 0 && (
            <PhotoPromptPanel
              photos={MOCK_PHOTOS}
              prompts={MOCK_PROMPTS}
              onAddPhotoPress={() => {
                // TODO: router.push('/profile/edit') photo picker flow once it exists.
              }}
              onEditPromptPress={() => {
                // TODO: router.push('/profile/edit') prompt editor once it exists.
              }}
              onAddPromptPress={() => {
                // TODO: router.push('/profile/edit') prompt editor once it exists.
              }}
            />
          )}

          {activeIndex === 1 && (
            <MatchmakerPanel
              score={MOCK_MATCHMAKER_STATS.score}
              percentileLabel={MOCK_MATCHMAKER_STATS.percentileLabel}
              introsSent={MOCK_MATCHMAKER_STATS.introsSent}
              introsAccepted={MOCK_MATCHMAKER_STATS.introsAccepted}
              hasSentIntros={MOCK_HAS_SENT_INTROS}
              badges={MOCK_BADGES}
            />
          )}

          {activeIndex === 2 && (
            <PrivacyPanel
              introducersCount={MOCK_INTRODUCERS_COUNT}
              blockedCount={MOCK_BLOCKED_COUNT}
              settings={privacySettings}
              onSettingsChange={setPrivacySettings}
            />
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}
