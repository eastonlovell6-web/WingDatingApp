import { useState } from "react";
import { View, Image, Text, ScrollView, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn } from "react-native-reanimated";
import { fonts, textStyles } from "../../constants/typography";
import { radii } from "../../constants/spacing";

const { width: SCREEN_W } = Dimensions.get("window");
const CONTENT_W = SCREEN_W - 48;
const PREVIEW_H = Math.round(CONTENT_W * 1.25);

export function PhotoCardPreview({ photos }: { photos: string[] }) {
  const filledPhotos = photos.filter(Boolean);
  const [previewIndex, setPreviewIndex] = useState(0);

  if (!filledPhotos.length) return null;

  return (
    <Animated.View entering={FadeIn.duration(320)} style={{ marginTop: 24 }}>
      <Text style={{ ...textStyles.eyebrow, marginBottom: 10 }}>
        Card Preview
      </Text>
      <View
        style={{
          borderRadius: radii.lg,
          overflow: "hidden",
          height: PREVIEW_H,
        }}
      >
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(
              e.nativeEvent.contentOffset.x / CONTENT_W
            );
            setPreviewIndex(idx);
          }}
        >
          {filledPhotos.map((uri, i) => (
            <Image
              key={i}
              source={{ uri }}
              style={{ width: CONTENT_W, height: PREVIEW_H }}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
        <LinearGradient
          colors={["transparent", "rgba(26,20,18,0.72)"]}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 68,
          }}
          pointerEvents="none"
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
        {filledPhotos.length > 1 && (
          <View
            style={{
              position: "absolute",
              bottom: 18,
              right: 14,
              flexDirection: "row",
              gap: 6,
            }}
            pointerEvents="none"
          >
            {filledPhotos.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === previewIndex ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor:
                    i === previewIndex ? "#fff" : "rgba(255,255,255,0.5)",
                }}
              />
            ))}
          </View>
        )}
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
  );
}
