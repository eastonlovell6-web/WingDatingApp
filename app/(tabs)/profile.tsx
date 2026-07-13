import { useEffect, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import type * as ImagePickerTypes from "expo-image-picker";
// Defensive require — matches the pattern in (auth)/onboarding.tsx: guards
// against the TurboModule crashing on custom dev builds missing a native
// rebuild, and against expo-image-picker having no web implementation.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ImagePicker: typeof ImagePickerTypes | null = (() => {
  try {
    return require("expo-image-picker");
  } catch {
    return null;
  }
})();
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { ProfileHeader } from "../../components/profile/ProfileHeader";
import { ProfileSegmentedControl } from "../../components/profile/ProfileSegmentedControl";
import { PhotoPromptPanel } from "../../components/profile/PhotoPromptPanel";
import { PromptEditorModal } from "../../components/profile/PromptEditorModal";
import { MatchmakerPanel } from "../../components/profile/MatchmakerPanel";
import { PrivacyPanel } from "../../components/profile/PrivacyPanel";
import { TAB_BAR_CLEARANCE } from "../../components/home/TabBar";
import { useAuthStore } from "../../store/auth";
import { getUserProfile, uploadProfilePhoto, upsertUserProfile } from "../../lib/supabase";
import { surface } from "../../constants/colors";
import { spacing } from "../../constants/spacing";
import {
  MOCK_BADGES,
  MOCK_BLOCKED_COUNT,
  MOCK_HAS_SENT_INTROS,
  MOCK_INTRODUCERS_COUNT,
  MOCK_MATCHMAKER_STATS,
  MOCK_NEXT_MILESTONE_COPY,
  MOCK_PHOTOS,
  MOCK_PRIVACY_SETTINGS,
  MOCK_PROFILE_USER,
  MOCK_PROMPTS,
  MOCK_RANK_PROGRESS,
} from "../../components/profile/mockProfile";
import type { PrivacySettings, ProfilePrompt } from "../../components/profile/mockProfile";
import { useIntrosStore } from "../../store/intros";

const SEGMENTS = ["Profile", "Matchmaker", "Privacy"];

function comingSoon(title: string) {
  Alert.alert(title, "This screen isn't built yet — hang tight.");
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["userProfile", userId],
    queryFn: () => getUserProfile(userId!),
    enabled: !!userId,
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const [photos, setPhotos] = useState<string[]>(MOCK_PHOTOS);
  const [prompts, setPrompts] = useState<ProfilePrompt[]>(MOCK_PROMPTS);
  const [uploadingPhotoIndex, setUploadingPhotoIndex] = useState<number | undefined>();
  const [promptEditor, setPromptEditor] = useState<{ index: number | null } | null>(null);
  // TODO: replace with a real privacy-settings store once that table exists.
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(MOCK_PRIVACY_SETTINGS);

  // Prefer the signed-in user's real saved photos/prompts as soon as any
  // exist; a brand-new account with an empty row still gets the demo set.
  useEffect(() => {
    if (!profile) return;
    if (profile.photos?.length) setPhotos(profile.photos);
    if (profile.bio_prompts?.length) setPrompts(profile.bio_prompts);
  }, [profile]);

  const name = profile?.name ?? MOCK_PROFILE_USER.name;

  function persistPhotos(next: string[]) {
    setPhotos(next);
    if (!userId) return;
    queryClient.setQueryData(["userProfile", userId], (old: typeof profile) =>
      old ? { ...old, photos: next } : old
    );
    upsertUserProfile(userId, { photos: next }).catch((err) => {
      console.error("Failed to save photos:", err);
    });
  }

  function persistPrompts(next: ProfilePrompt[]) {
    setPrompts(next);
    if (!userId) return;
    queryClient.setQueryData(["userProfile", userId], (old: typeof profile) =>
      old ? { ...old, bio_prompts: next } : old
    );
    upsertUserProfile(userId, { bio_prompts: next }).catch((err) => {
      console.error("Failed to save prompts:", err);
    });
  }

  async function pickAndUploadPhoto(index: number) {
    if (!ImagePicker) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 5],
    });
    if (result.canceled) return;

    const localUri = result.assets[0].uri;
    const optimistic = [...photos];
    optimistic[index] = localUri;
    setPhotos(optimistic);

    if (!userId) return; // Local-only preview when there's no session to save against.

    setUploadingPhotoIndex(index);
    try {
      const hostedUrl = await uploadProfilePhoto(userId, localUri);
      const next = [...optimistic];
      next[index] = hostedUrl;
      persistPhotos(next);
    } catch (err) {
      console.error("Photo upload failed:", err);
    } finally {
      setUploadingPhotoIndex(undefined);
    }
  }

  function handlePhotoSlotPress(index: number) {
    if (!photos[index]) {
      pickAndUploadPhoto(index);
      return;
    }

    const options: { text: string; style?: "destructive" | "cancel"; onPress?: () => void }[] = [];
    if (index !== 0) {
      options.push({
        text: "Set as main photo",
        onPress: () => {
          const next = [...photos];
          [next[0], next[index]] = [next[index], next[0]];
          persistPhotos(next);
        },
      });
    }
    options.push({ text: "Replace photo", onPress: () => pickAndUploadPhoto(index) });
    options.push({
      text: "Remove photo",
      style: "destructive",
      onPress: () => persistPhotos(photos.filter((_, i) => i !== index)),
    });
    options.push({ text: "Cancel", style: "cancel" });

    Alert.alert(index === 0 ? "Main photo" : "Photo", undefined, options);
  }

  function handleSavePrompt(question: string, answer: string) {
    if (!promptEditor) return;
    const next = [...prompts];
    if (promptEditor.index === null) {
      next.push({ question, answer });
    } else {
      next[promptEditor.index] = { question, answer };
    }
    persistPrompts(next);
    setPromptEditor(null);
  }

  function handleRemovePrompt() {
    if (!promptEditor || promptEditor.index === null) return;
    persistPrompts(prompts.filter((_, i) => i !== promptEditor.index));
    setPromptEditor(null);
  }

  const sentIntros = useIntrosStore((s) => s.sentIntros);
  const pendingIntro = sentIntros.find((intro) => intro.status === "pending");

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
          name={name}
          meta={MOCK_PROFILE_USER.meta}
          avatarUri={photos[0]}
          onEditPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveIndex(0);
          }}
          onSettingsPress={() => comingSoon("Account settings")}
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
              photos={photos}
              prompts={prompts}
              uploadingPhotoIndex={uploadingPhotoIndex}
              onPhotoSlotPress={handlePhotoSlotPress}
              onEditPromptPress={(index) => setPromptEditor({ index })}
              onAddPromptPress={() => setPromptEditor({ index: null })}
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
              rankProgress={MOCK_RANK_PROGRESS}
              nextMilestoneCopy={MOCK_NEXT_MILESTONE_COPY}
              pendingIntro={pendingIntro}
              onMakeIntroPress={() => comingSoon("Matchmaker")}
            />
          )}

          {activeIndex === 2 && (
            <PrivacyPanel
              introducersCount={MOCK_INTRODUCERS_COUNT}
              blockedCount={MOCK_BLOCKED_COUNT}
              settings={privacySettings}
              onSettingsChange={setPrivacySettings}
              onVisibilityPress={() => comingSoon("Friend visibility settings")}
              onBlockedListPress={() => comingSoon("Blocked & hidden")}
              onAccountSettingsPress={() => comingSoon("Account settings")}
            />
          )}
        </Animated.View>
      </ScrollView>

      <PromptEditorModal
        visible={promptEditor !== null}
        initialQuestion={promptEditor?.index != null ? prompts[promptEditor.index]?.question : undefined}
        initialAnswer={promptEditor?.index != null ? prompts[promptEditor.index]?.answer : undefined}
        usedQuestions={prompts.filter((_, i) => i !== promptEditor?.index).map((p) => p.question)}
        onSave={handleSavePrompt}
        onRemove={promptEditor?.index != null ? handleRemovePrompt : undefined}
        onClose={() => setPromptEditor(null)}
      />
    </View>
  );
}
