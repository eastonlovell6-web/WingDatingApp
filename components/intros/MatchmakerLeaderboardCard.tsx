import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Avatar } from "../ui/Avatar";
import { ink, plum, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { elevation } from "../../constants/elevation";
import { rankedLeaderboard, type LeaderboardEntry } from "./mockLeaderboard";

interface MatchmakerLeaderboardCardProps {
  entries: LeaderboardEntry[];
}

const cardSpring = { mass: 0.4, damping: 12, stiffness: 220 };

// Simple trophy glyph, same construction as components/ui/TabGlyphs.
function TrophyGlyph({ size = 22, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 4h10v3.5a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M12 12.5v3" stroke={color} strokeWidth={1.8} />
      <Path d="M8.5 18.5h7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M10 18.5v-2.8h4v2.8" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M7 5.5H4.5a2 2 0 0 0 2 3.2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M17 5.5h2.5a2 2 0 0 1-2 3.2" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function MatchmakerLeaderboardCard({ entries }: MatchmakerLeaderboardCardProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const ranked = rankedLeaderboard(entries);
  const currentUserRank = ranked.findIndex((e) => e.isCurrentUser) + 1;

  return (
    <>
      <Pressable
        onPressIn={() => (scale.value = withSpring(0.98, cardSpring))}
        onPressOut={() => (scale.value = withSpring(1, cardSpring))}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`You're ranked number ${currentUserRank} among your friends. Tap to see the full leaderboard.`}
      >
        <Animated.View style={[elevation.sm, animatedStyle]}>
          <LinearGradient
            colors={[plum[500], plum[600]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing[4],
              borderRadius: radii.xl,
              padding: spacing[6],
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radii.pill,
                backgroundColor: "rgba(255,255,255,0.16)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <TrophyGlyph size={22} />
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontFamily: fonts.monoMedium,
                  fontSize: fontSize.xs[0],
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                Matchmaker rank
              </Text>
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: fontSize.lg[0],
                  lineHeight: fontSize.lg[1],
                  color: "#FFFFFF",
                }}
              >
                You&rsquo;re #{currentUserRank} among your friends
              </Text>
            </View>

            <Text style={{ fontFamily: fonts.body, fontSize: fontSize.lg[0], color: "rgba(255,255,255,0.75)" }}>
              ›
            </Text>
          </LinearGradient>
        </Animated.View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(26,20,18,0.45)" }}
        >
          <View
            pointerEvents="box-none"
            style={{
              flex: 1,
              justifyContent: "flex-end",
              paddingHorizontal: spacing[4],
              paddingBottom: insets.bottom + spacing[4],
            }}
          >
            <Pressable onPress={() => {}}>
              <View
                style={{
                  backgroundColor: surface.paper,
                  borderRadius: radii.xl,
                  padding: spacing[6],
                  maxHeight: 480,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: spacing[4],
                  }}
                >
                  <View style={{ gap: 2, flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: fonts.displaySemibold,
                        fontSize: fontSize.xl[0],
                        lineHeight: fontSize.xl[1],
                        color: ink[900],
                      }}
                    >
                      Matchmaker leaderboard
                    </Text>
                    <Text
                      style={{ fontFamily: fonts.body, fontSize: fontSize.sm[0], color: ink[500] }}
                    >
                      Ranked by matches made, among your friend group.
                    </Text>
                  </View>
                  <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: radii.pill,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: ink[100],
                      }}
                    >
                      <Text style={{ fontFamily: fonts.body, fontSize: 16, color: ink[700] }}>✕</Text>
                    </View>
                  </Pressable>
                </View>

                <ScrollView>
                  {ranked.map((entry, i) => (
                    <View
                      key={entry.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing[4],
                        paddingVertical: spacing[2] + 2,
                        paddingHorizontal: spacing[2],
                        marginBottom: spacing[2],
                        borderRadius: radii.md,
                        backgroundColor: entry.isCurrentUser ? plum[100] : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          width: 20,
                          fontFamily: fonts.monoMedium,
                          fontSize: fontSize.sm[0],
                          color: ink[500],
                          textAlign: "center",
                        }}
                      >
                        {i + 1}
                      </Text>
                      <Avatar name={entry.name} size={36} index={i} imageUri={entry.avatarUri} />
                      <Text
                        style={{
                          flex: 1,
                          fontFamily: fonts.bodyMedium,
                          fontSize: fontSize.base[0],
                          color: ink[900],
                        }}
                        numberOfLines={1}
                      >
                        {entry.isCurrentUser ? "You" : entry.name}
                      </Text>
                      <Text
                        style={{
                          fontFamily: fonts.monoMedium,
                          fontSize: fontSize.xs[0],
                          color: plum[600],
                        }}
                      >
                        {entry.introsAccepted} matched
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export default MatchmakerLeaderboardCard;
