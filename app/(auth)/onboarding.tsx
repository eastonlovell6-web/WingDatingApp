import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { coral, ink, surface } from "../../constants/colors";
import { fonts, textStyles } from "../../constants/typography";
import { radii } from "../../constants/spacing";
import { Button } from "../../components/ui/Button";
import { useAuthStore } from "../../store/auth";
import { uploadProfilePhoto, upsertUserProfile } from "../../lib/supabase";

const { width: SCREEN_W } = Dimensions.get("window");
const CONTENT_W = SCREEN_W - 48;
const GAP = 8;
const TOP_ROW_H = 264;
const BOTTOM_SLOT = Math.floor((CONTENT_W - GAP * 2) / 3);

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

function PhotoSlot({
  uri,
  onPress,
  isPrimary,
}: {
  uri?: string;
  onPress: () => void;
  isPrimary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.82 : 1,
      })}
    >
      {uri ? (
        <>
          <Image
            source={{ uri }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
          {isPrimary && (
            <View
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                backgroundColor: "rgba(0,0,0,0.38)",
                paddingHorizontal: 7,
                paddingVertical: 3,
                borderRadius: 6,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 10,
                  color: "#fff",
                  letterSpacing: 0.8,
                }}
              >
                PRIMARY
              </Text>
            </View>
          )}
        </>
      ) : (
        <View style={{ alignItems: "center", gap: 4 }}>
          <Text
            style={{
              fontSize: isPrimary ? 24 : 18,
              color: isPrimary ? coral[500] : ink[300],
              fontFamily: fonts.bodyMedium,
              lineHeight: isPrimary ? 28 : 22,
            }}
          >
            +
          </Text>
          {isPrimary && (
            <Text
              style={{ fontFamily: fonts.body, fontSize: 12, color: ink[500] }}
            >
              Tap to add
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

function SlotFrame({
  index,
  photos,
  onPress,
  style,
}: {
  index: number;
  photos: string[];
  onPress: (i: number) => void;
  style?: object;
}) {
  const uri = photos[index];
  const isPrimary = index === 0;
  const empty = !uri;

  return (
    <View
      style={[
        {
          borderRadius: radii.md,
          backgroundColor: empty ? surface.creamDeep : "transparent",
          borderWidth: empty ? 1.5 : 0,
          borderColor: isPrimary ? coral[300] : ink[200],
        },
        style,
      ]}
    >
      <View style={{ flex: 1, borderRadius: radii.md, overflow: "hidden" }}>
        <PhotoSlot
          uri={uri}
          onPress={() => onPress(index)}
          isPrimary={isPrimary}
        />
      </View>
    </View>
  );
}

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  async function openCamera() {
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
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
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
    if (i === 0) openCamera();
    else openGallery(i);
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
  const firstPhoto = photos.find(Boolean);

  if (step >= 1) {
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
          Step 2 coming next.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      {/* Step indicator */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 24,
          paddingBottom: 12,
        }}
      >
        <StepDots step={0} />
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
            Add your best photo
          </Text>
          <Text style={{ ...textStyles.caption, marginBottom: 20 }}>
            This is the first thing people see. Make it you.
          </Text>
        </Animated.View>

        {/* Photo grid */}
        <Animated.View entering={FadeInUp.duration(260).delay(140)}>
          {/* Top row: large primary (2/3) + 2 stacked (1/3) */}
          <View style={{ flexDirection: "row", gap: GAP, height: TOP_ROW_H }}>
            <SlotFrame
              index={0}
              photos={photos}
              onPress={handleSlotPress}
              style={{ flex: 2 }}
            />
            <View style={{ flex: 1, gap: GAP }}>
              <SlotFrame
                index={1}
                photos={photos}
                onPress={handleSlotPress}
                style={{ flex: 1 }}
              />
              <SlotFrame
                index={2}
                photos={photos}
                onPress={handleSlotPress}
                style={{ flex: 1 }}
              />
            </View>
          </View>

          {/* Bottom row: 3 equal squares */}
          <View
            style={{ flexDirection: "row", gap: GAP, marginTop: GAP }}
          >
            {[3, 4, 5].map((i) => (
              <SlotFrame
                key={i}
                index={i}
                photos={photos}
                onPress={handleSlotPress}
                style={{ flex: 1, height: BOTTOM_SLOT }}
              />
            ))}
          </View>
        </Animated.View>

        {/* Card preview — slides in when first photo is added */}
        {hasPhoto && (
          <Animated.View entering={FadeIn.duration(320)} style={{ marginTop: 24 }}>
            <Text
              style={{
                ...textStyles.eyebrow,
                marginBottom: 10,
              }}
            >
              Card Preview
            </Text>
            <View
              style={{
                borderRadius: radii.lg,
                overflow: "hidden",
                height: 120,
              }}
            >
              <Image
                source={{ uri: firstPhoto }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
              <LinearGradient
                colors={["transparent", "rgba(26,20,18,0.72)"]}
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 68,
                }}
              />
              <Text
                style={{
                  position: "absolute",
                  bottom: 14,
                  left: 14,
                  fontFamily: fonts.displaySemibold,
                  fontSize: 18,
                  color: "#fff",
                  letterSpacing: -0.2,
                }}
              >
                You
              </Text>
            </View>
            <Text
              style={{
                ...textStyles.caption,
                textAlign: "center",
                marginTop: 8,
              }}
            >
              This is how you'll appear in intros
            </Text>
          </Animated.View>
        )}

        {/* Library link */}
        <Animated.View
          entering={FadeInUp.duration(260).delay(200)}
          style={{ alignItems: "center", marginTop: 20 }}
        >
          <TouchableOpacity
            onPress={() => {
              const firstEmpty = photos.findIndex((p) => !p);
              openGallery(firstEmpty === -1 ? 0 : firstEmpty);
            }}
          >
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: 14,
                color: ink[500],
                textDecorationLine: "underline",
              }}
            >
              Choose from library
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
