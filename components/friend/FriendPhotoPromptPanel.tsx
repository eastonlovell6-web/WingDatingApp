import { useState } from "react";
import {
  Image,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  View,
} from "react-native";
import { coral, ink, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import type { ProfilePrompt } from "../profile/mockProfile";

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

function ReadOnlyPhotoCarousel({ photos }: { photos: string[] }) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  function handleLayout(e: LayoutChangeEvent) {
    setContainerWidth(e.nativeEvent.layout.width);
  }

  function handleMomentumScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!containerWidth) return;
    setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / containerWidth));
  }

  return (
    <View onLayout={handleLayout} style={{ gap: spacing[2] }}>
      {containerWidth > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
        >
          {photos.map((uri, i) => (
            <View key={`${uri}-${i}`} style={{ width: containerWidth, aspectRatio: 4 / 5, padding: 2 }}>
              <Image source={{ uri }} style={{ width: "100%", height: "100%", borderRadius: radii.lg }} />
            </View>
          ))}
        </ScrollView>
      )}
      <CarouselDots count={photos.length} activeIndex={activeIndex} />
    </View>
  );
}

function ReadOnlyPromptCard({ prompt }: { prompt: ProfilePrompt }) {
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
      <Text
        style={{
          fontFamily: fonts.body,
          fontSize: fontSize.sm[0],
          lineHeight: fontSize.sm[1],
          color: ink[500],
        }}
      >
        {prompt.question}
      </Text>
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

interface FriendPhotoPromptPanelProps {
  photos: string[];
  prompts: ProfilePrompt[];
}

export function FriendPhotoPromptPanel({ photos, prompts }: FriendPhotoPromptPanelProps) {
  return (
    <View style={{ gap: spacing[6] }}>
      <ReadOnlyPhotoCarousel photos={photos} />
      <View style={{ gap: spacing[4] }}>
        {prompts.map((prompt, i) => (
          <ReadOnlyPromptCard key={i} prompt={prompt} />
        ))}
      </View>
    </View>
  );
}

export default FriendPhotoPromptPanel;
