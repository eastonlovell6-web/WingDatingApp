import { useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import { Button } from "../ui/Button";
import { MatchmakerShareCard } from "./MatchmakerShareCard";
import { ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";
import type { MatchmakerBadge } from "./mockProfile";

function CloseIcon({ size = 22, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1={6} y1={6} x2={18} y2={18} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={18} y1={6} x2={6} y2={18} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

interface ShareScoreModalProps {
  visible: boolean;
  onClose: () => void;
  score: number;
  rankTier: string;
  rankLevel: number;
  percentileLabel: string;
  badges: MatchmakerBadge[];
}

export function ShareScoreModal({
  visible,
  onClose,
  score,
  rankTier,
  rankLevel,
  percentileLabel,
  badges,
}: ShareScoreModalProps) {
  const viewShotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (uri) {
        await Sharing.shareAsync(uri);
      }
    } catch (err) {
      console.error("Failed to share matchmaker score:", err);
    } finally {
      setSharing(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(26,20,18,0.85)",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing[6],
          padding: spacing[6],
        }}
      >
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          style={{ position: "absolute", top: spacing[10], right: spacing[6] }}
        >
          <CloseIcon />
        </Pressable>

        <ViewShot
          ref={viewShotRef}
          options={{ format: "png", quality: 1, result: "tmpfile", width: 1080, height: 1920 }}
        >
          <MatchmakerShareCard
            score={score}
            rankTier={rankTier}
            rankLevel={rankLevel}
            percentileLabel={percentileLabel}
            badges={badges}
          />
        </ViewShot>

        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.sm[0],
            color: ink[100],
            textAlign: "center",
          }}
        >
          {"Sized for Instagram Story & iMessage (1080×1920)"}
        </Text>

        <Button
          title={sharing ? "Preparing..." : "Share"}
          onPress={handleShare}
          loading={sharing}
          style={{ width: "100%" }}
        />
      </View>
    </Modal>
  );
}

export default ShareScoreModal;
