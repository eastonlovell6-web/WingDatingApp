import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, TouchableOpacity } from "react-native";
import type * as ImagePickerTypes from "expo-image-picker";
// Defensive require — TurboModule crash on custom dev builds missing native rebuild
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ImagePicker: typeof ImagePickerTypes | null = (() => {
  try { return require("expo-image-picker"); } catch { return null; }
})();
import { router, useLocalSearchParams } from "expo-router";
import Animated, { FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { coral, ink, surface } from "../../constants/colors";
import { fonts, textStyles } from "../../constants/typography";
import { Button } from "../../components/ui/Button";
import { PhotoGrid } from "../../components/onboarding/PhotoGrid";
import { PhotoCardPreview } from "../../components/onboarding/PhotoCardPreview";
import { FriendVisibilityList } from "../../components/onboarding/FriendVisibilityList";
import { CelebrationStep } from "../../components/onboarding/CelebrationStep";
import { useAuthStore } from "../../store/auth";
import { uploadProfilePhoto, upsertUserProfile } from "../../lib/supabase";

// Placeholder until contacts-sync + the friendships table are wired up.
const MOCK_FRIENDS = [
  { id: "1", name: "Maya Torres" },
  { id: "2", name: "Jordan Lee" },
  { id: "3", name: "Sam Okafor" },
  { id: "4", name: "Ava Bennett" },
  { id: "5", name: "Noah Kim" },
  { id: "6", name: "Priya Shah" },
  { id: "7", name: "Ethan Brooks" },
  { id: "8", name: "Zoe Marchetti" },
  { id: "9", name: "Lucas Ferreira" },
  { id: "10", name: "Chloe Nguyen" },
];

function ChevronLeft() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke={ink[500]}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function StepDots({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 6, justifyContent: "center" }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: i === step ? 20 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === step ? coral[500] : ink[200],
          }}
        />
      ))}
    </View>
  );
}

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  // Set on the "What brings you to Wing?" screen; shapes the photos headline.
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const photosHeadline =
    intent === "wing-somebody"
      ? "Put a face to the matchmaker"
      : "Give your wingman something to work with";
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  // can_introduce defaults false for every friend — explicit opt-in only.
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});

  async function openCamera() {
    if (!ImagePicker) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      openGallery(0);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: true,
    });
    if (!result.canceled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPhotos((prev) => {
        const n = [...prev];
        n[0] = result.assets[0].uri;
        return n;
      });
    }
  }

  async function openGallery(slotIndex: number) {
    if (!ImagePicker) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.85,
      allowsEditing: true,
    });
    if (!result.canceled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPhotos((prev) => {
        const n = [...prev];
        n[slotIndex] = result.assets[0].uri;
        return n;
      });
    }
  }

  function handleSlotPress(i: number) {
    openGallery(i);
  }

  async function handleContinue() {
    if (!user?.id) return;
    const filled = photos.filter(Boolean);
    if (!filled.length) return;
    setIsUploading(true);
    try {
      const urls = await Promise.all(
        filled.map((uri) => uploadProfilePhoto(user.id, uri))
      );
      await upsertUserProfile(user.id, { photos: urls });
      setStep(1);
    } catch (err) {
      console.error("Photo upload failed:", err);
    } finally {
      setIsUploading(false);
    }
  }

  const hasPhoto = photos.some(Boolean);

  function toggleFriend(id: string) {
    setVisibility((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function selectAllFriends() {
    setVisibility(
      Object.fromEntries(MOCK_FRIENDS.map((f) => [f.id, true]))
    );
  }

  function selectNoFriends() {
    setVisibility({});
  }

  if (step >= 3) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: surface.cream,
          alignItems: "center",
          justifyContent: "center",
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 28,
            color: ink[900],
            letterSpacing: -0.5,
          }}
        >
          Home is coming next.
        </Text>
      </View>
    );
  }

  if (step === 2) {
    return <CelebrationStep intent={intent} onContinue={() => setStep(3)} />;
  }

  if (step === 1) {
    return (
      <View style={{ flex: 1, backgroundColor: surface.cream }}>
        {/* Top bar — back to the photos step, step dots centered */}
        <View
          style={{
            paddingTop: insets.top + 16,
            paddingHorizontal: 24,
            paddingBottom: 24,
            justifyContent: "center",
          }}
        >
          <StepDots step={1} />
          <Pressable
            onPress={() => setStep(0)}
            hitSlop={12}
            style={{ position: "absolute", left: 24, top: insets.top + 13 }}
          >
            <ChevronLeft />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInUp.duration(260).delay(80)}>
            <Text style={{ ...textStyles.eyebrow, marginBottom: 8 }}>
              Step 2 of 3
            </Text>
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 36,
                color: ink[900],
                letterSpacing: -0.5,
                lineHeight: 42,
                marginBottom: 8,
              }}
            >
              Who can introduce you?
            </Text>
            <Text style={{ ...textStyles.caption, marginBottom: 20 }}>
              Only friends you approve can suggest matches for you. You can
              change this anytime.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(260).delay(140)}>
            <FriendVisibilityList
              friends={MOCK_FRIENDS}
              visibility={visibility}
              onToggle={toggleFriend}
              onSelectAll={selectAllFriends}
              onSelectNone={selectNoFriends}
            />
          </Animated.View>
        </ScrollView>

        {/* Pinned bottom CTA */}
        <View
          style={{
            paddingHorizontal: 24,
            paddingBottom: insets.bottom + 24,
            paddingTop: 12,
            backgroundColor: surface.cream,
          }}
        >
          <Button title="Continue" onPress={() => setStep(2)} />
          <Pressable
            onPress={() => setStep(2)}
            hitSlop={8}
            style={{ alignItems: "center", marginTop: 14 }}
          >
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: 14,
                color: ink[500],
                textDecorationLine: "underline",
              }}
            >
              I'll do this later
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      {/* Top bar — back to the intent screen, step dots centered */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 24,
          paddingBottom: 24,
          justifyContent: "center",
        }}
      >
        <StepDots step={0} />
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(auth)/intent");
          }}
          hitSlop={12}
          style={{ position: "absolute", left: 24, top: insets.top + 13 }}
        >
          <ChevronLeft />
        </Pressable>
      </View>

      {/* Scrollable content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Headline */}
        <Animated.View entering={FadeInUp.duration(260).delay(80)}>
          <Text style={{ ...textStyles.eyebrow, marginBottom: 8 }}>
            Step 1 of 3
          </Text>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 36,
              color: ink[900],
              letterSpacing: -0.5,
              lineHeight: 42,
              marginBottom: 8,
            }}
          >
            {photosHeadline}
          </Text>
          <Text style={{ ...textStyles.caption, marginBottom: 20 }}>
            This is the first thing people see. Make it you.
          </Text>
        </Animated.View>

        <PhotoGrid photos={photos} onSlotPress={handleSlotPress} />

        {hasPhoto && <PhotoCardPreview photos={photos} />}

        {/* Camera link */}
        <Animated.View
          entering={FadeInUp.duration(260).delay(200)}
          style={{ alignItems: "center", marginTop: 20 }}
        >
          <TouchableOpacity onPress={openCamera}>
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: 14,
                color: ink[500],
                textDecorationLine: "underline",
              }}
            >
              Take a photo
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* Pinned bottom CTA */}
      <View
        style={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 24,
          paddingTop: 12,
          backgroundColor: surface.cream,
        }}
      >
        <Button
          title="Continue"
          onPress={handleContinue}
          disabled={!hasPhoto || isUploading}
          loading={isUploading}
        />
        <Text
          style={{
            ...textStyles.caption,
            textAlign: "center",
            marginTop: 10,
          }}
        >
          You can add more later
        </Text>
      </View>
    </View>
  );
}
