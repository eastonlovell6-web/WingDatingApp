import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Path } from "react-native-svg";
import { Button } from "../ui/Button";
import { coral, ink, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import type { ProfilePrompt } from "./mockProfile";

const MAX_PHOTOS = 6;
const MAX_PROMPTS = 3;

function PlusIcon({ size = 20, color = ink[300] }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function PencilIcon({ size = 16, color = ink[500] }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 20l0.9-4 10.4-10.4a1.5 1.5 0 0 1 2.1 0l1 1a1.5 1.5 0 0 1 0 2.1L8 19.1 4 20z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CarouselDots({ count, activeIndex }: { count: number; activeIndex: number }) {
  if (count <= 1) return null;
  return (
    <View style={{ flexDirection: "row", gap: 6, justifyContent: "center" }}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            width: i === activeIndex ? 20 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === activeIndex ? coral[500] : ink[200],
          }}
        />
      ))}
    </View>
  );
}

function PhotoCarousel({
  photos,
  uploadingIndex,
  onSlotPress,
}: {
  photos: string[];
  uploadingIndex?: number;
  onSlotPress: (index: number) => void;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  function handleLayout(e: LayoutChangeEvent) {
    setContainerWidth(e.nativeEvent.layout.width);
  }

  function handleMomentumScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!containerWidth) return;
    setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / containerWidth));
  }

  // One trailing "add" slot (represented as null) — up to MAX_PHOTOS total.
  const slots: (string | null)[] = photos.length < MAX_PHOTOS ? [...photos, null] : photos;

  return (
    <View onLayout={handleLayout} style={{ gap: spacing[2] }}>
      {containerWidth > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
        >
          {slots.map((uri, i) => {
            const isUploading = uploadingIndex === i;
            return (
              <Pressable
                key={uri ?? `add-${i}`}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSlotPress(i);
                }}
                accessibilityRole="button"
                accessibilityLabel={uri ? (i === 0 ? "Main photo, tap for options" : "Photo, tap for options") : "Add photo"}
                style={{ width: containerWidth, aspectRatio: 4 / 5, padding: 2 }}
              >
                {uri ? (
                  <>
                    <Image
                      source={{ uri }}
                      style={{ width: "100%", height: "100%", borderRadius: radii.lg }}
                    />
                    {i === 0 && (
                      <View
                        style={{
                          position: "absolute",
                          top: spacing[2] + 2,
                          left: spacing[2] + 2,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: radii.sm,
                          backgroundColor: "rgba(26, 20, 18, 0.55)",
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: fonts.monoMedium,
                            fontSize: fontSize["2xs"][0],
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            color: "#FFFFFF",
                          }}
                        >
                          Main
                        </Text>
                      </View>
                    )}
                    {isUploading && (
                      <View
                        style={[
                          StyleSheet.absoluteFillObject,
                          {
                            margin: 2,
                            borderRadius: radii.lg,
                            backgroundColor: "rgba(26, 20, 18, 0.35)",
                            alignItems: "center",
                            justifyContent: "center",
                          },
                        ]}
                      >
                        <ActivityIndicator color="#FFFFFF" />
                      </View>
                    )}
                  </>
                ) : (
                  <View
                    style={{
                      flex: 1,
                      borderRadius: radii.lg,
                      borderWidth: 1.5,
                      borderColor: ink[300],
                      borderStyle: "dashed",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isUploading ? <ActivityIndicator color={coral[500]} /> : <PlusIcon size={32} />}
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <CarouselDots count={slots.length} activeIndex={activeIndex} />
    </View>
  );
}

function PromptCard({
  prompt,
  onEditPress,
}: {
  prompt: ProfilePrompt;
  onEditPress: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: surface.paper,
        borderRadius: radii.lg,
        padding: spacing[4],
        gap: spacing[2],
        shadowColor: shadowTint,
        shadowOpacity: 1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing[2] }}>
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.sm[0],
            lineHeight: fontSize.sm[1],
            color: ink[500],
            flexShrink: 1,
          }}
        >
          {prompt.question}
        </Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onEditPress();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Edit prompt"
        >
          <PencilIcon />
        </Pressable>
      </View>
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: fontSize.xl[0],
          lineHeight: fontSize.xl[1],
          letterSpacing: -0.2,
          color: ink[900],
        }}
      >
        {prompt.answer}
      </Text>
    </View>
  );
}

interface PhotoPromptPanelProps {
  photos: string[];
  prompts: ProfilePrompt[];
  uploadingPhotoIndex?: number;
  onPhotoSlotPress: (index: number) => void;
  onEditPromptPress: (index: number) => void;
  onAddPromptPress: () => void;
}

export function PhotoPromptPanel({
  photos,
  prompts,
  uploadingPhotoIndex,
  onPhotoSlotPress,
  onEditPromptPress,
  onAddPromptPress,
}: PhotoPromptPanelProps) {
  return (
    <View style={{ gap: spacing[6] }}>
      <PhotoCarousel photos={photos} uploadingIndex={uploadingPhotoIndex} onSlotPress={onPhotoSlotPress} />

      <View style={{ gap: spacing[4] }}>
        {prompts.map((prompt, i) => (
          <PromptCard key={i} prompt={prompt} onEditPress={() => onEditPromptPress(i)} />
        ))}

        {prompts.length < MAX_PROMPTS && (
          <Button
            title="Add a prompt"
            variant="outline"
            onPress={onAddPromptPress}
            style={{ height: 48, borderColor: ink[300] }}
          />
        )}
      </View>
    </View>
  );
}

export default PhotoPromptPanel;
