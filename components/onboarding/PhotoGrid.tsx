import { View, Image, Text, Pressable, Dimensions } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { coral, ink, surface } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { radii } from "../../constants/spacing";

const { width: SCREEN_W } = Dimensions.get("window");
const CONTENT_W = SCREEN_W - 48;
const GAP = 8;
const TOP_ROW_H = 264;
const BOTTOM_SLOT = Math.floor((CONTENT_W - GAP * 2) / 3);
const STACKED_H = Math.floor((TOP_ROW_H - GAP) / 2);

function PhotoSlot({
  uri,
  onPress,
  isPrimary,
  height,
}: {
  uri?: string;
  onPress: () => void;
  isPrimary?: boolean;
  height: number;
}) {
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View
          style={{
            width: "100%",
            height,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.82 : 1,
          }}
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
                  style={{
                    fontFamily: fonts.body,
                    fontSize: 12,
                    color: ink[500],
                  }}
                >
                  Tap to add
                </Text>
              )}
            </View>
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
  height,
}: {
  index: number;
  photos: string[];
  onPress: (i: number) => void;
  style?: object;
  height: number;
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
          height={height}
        />
      </View>
    </View>
  );
}

export function PhotoGrid({
  photos,
  onSlotPress,
}: {
  photos: string[];
  onSlotPress: (i: number) => void;
}) {
  return (
    <Animated.View entering={FadeInUp.duration(260).delay(140)}>
      {/* Top row: large primary (2/3) + 2 stacked (1/3) */}
      <View style={{ flexDirection: "row", gap: GAP, height: TOP_ROW_H }}>
        <SlotFrame
          index={0}
          photos={photos}
          onPress={onSlotPress}
          style={{ flex: 2 }}
          height={TOP_ROW_H}
        />
        <View style={{ flex: 1, gap: GAP }}>
          <SlotFrame
            index={1}
            photos={photos}
            onPress={onSlotPress}
            style={{ flex: 1 }}
            height={STACKED_H}
          />
          <SlotFrame
            index={2}
            photos={photos}
            onPress={onSlotPress}
            style={{ flex: 1 }}
            height={STACKED_H}
          />
        </View>
      </View>

      {/* Bottom row: 3 equal squares */}
      <View style={{ flexDirection: "row", gap: GAP, marginTop: GAP }}>
        {[3, 4, 5].map((i) => (
          <SlotFrame
            key={i}
            index={i}
            photos={photos}
            onPress={onSlotPress}
            style={{ flex: 1, height: BOTTOM_SLOT }}
            height={BOTTOM_SLOT}
          />
        ))}
      </View>
    </Animated.View>
  );
}
