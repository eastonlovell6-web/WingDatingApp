import { useState } from "react";
import { Image, LayoutChangeEvent, Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Path } from "react-native-svg";
import { Button } from "../ui/Button";
import { ink, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import type { ProfilePhoto, ProfilePrompt } from "./mockProfile";

const GRID_COLUMNS = 3;
const GRID_SLOTS = 6;
const GRID_GAP = spacing[2];
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

function PhotoGrid({ photos, onAddPress }: { photos: ProfilePhoto[]; onAddPress?: () => void }) {
  const [gridWidth, setGridWidth] = useState(0);
  const tileWidth = gridWidth > 0 ? (gridWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS : 0;

  function handleLayout(e: LayoutChangeEvent) {
    setGridWidth(e.nativeEvent.layout.width);
  }

  const slots = Array.from({ length: GRID_SLOTS }, (_, i) => photos[i] ?? null);

  return (
    <View onLayout={handleLayout} style={{ flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP }}>
      {tileWidth > 0 &&
        slots.map((photo, i) =>
          photo ? (
            <View key={photo.id} style={{ width: tileWidth, aspectRatio: 4 / 5 }}>
              <Image
                source={{ uri: photo.uri }}
                style={{ width: "100%", height: "100%", borderRadius: radii.md }}
              />
              {photo.isMain && (
                <View
                  style={{
                    position: "absolute",
                    top: spacing[2] / 2,
                    left: spacing[2] / 2,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
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
            </View>
          ) : (
            <Pressable
              key={`empty-${i}`}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onAddPress?.();
              }}
              accessibilityRole="button"
              accessibilityLabel="Add photo"
              style={{
                width: tileWidth,
                aspectRatio: 4 / 5,
                borderRadius: radii.md,
                borderWidth: 1.5,
                borderColor: ink[300],
                borderStyle: "dashed",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PlusIcon />
            </Pressable>
          )
        )}
    </View>
  );
}

function PromptCard({ prompt, onEditPress }: { prompt: ProfilePrompt; onEditPress?: (id: string) => void }) {
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
            onEditPress?.(prompt.id);
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
  photos: ProfilePhoto[];
  prompts: ProfilePrompt[];
  onAddPhotoPress?: () => void;
  onEditPromptPress?: (id: string) => void;
  onAddPromptPress?: () => void;
}

export function PhotoPromptPanel({
  photos,
  prompts,
  onAddPhotoPress,
  onEditPromptPress,
  onAddPromptPress,
}: PhotoPromptPanelProps) {
  return (
    <View style={{ gap: spacing[6] }}>
      <PhotoGrid photos={photos} onAddPress={onAddPhotoPress} />

      <View style={{ gap: spacing[4] }}>
        {prompts.map((prompt) => (
          <PromptCard key={prompt.id} prompt={prompt} onEditPress={onEditPromptPress} />
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
