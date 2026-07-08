import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { coral, ink, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";

interface ChatInputProps {
  onSend: (content: string) => void;
  bottomInset?: number;
}

function SendIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Line x1={12} y1={19} x2={12} y2={5} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Line x1={6} y1={11} x2={12} y2={5} stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={18} y1={11} x2={12} y2={5} stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChatInput({ onSend, bottomInset = 0 }: ChatInputProps) {
  const [text, setText] = useState("");
  const canSend = text.trim().length > 0;

  function handleSend() {
    if (!canSend) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(text.trim());
    setText("");
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: spacing[2],
        paddingHorizontal: spacing[4],
        paddingTop: spacing[2],
        paddingBottom: spacing[2] + bottomInset,
        backgroundColor: surface.cream,
      }}
    >
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Message"
        placeholderTextColor={ink[500]}
        multiline
        style={{
          flex: 1,
          maxHeight: 120,
          minHeight: 44,
          borderRadius: radii.lg,
          backgroundColor: surface.paper,
          paddingHorizontal: spacing[4],
          paddingVertical: 10,
          fontFamily: fonts.body,
          fontSize: fontSize.base[0],
          color: ink[900],
        }}
      />
      <Pressable onPress={handleSend} disabled={!canSend} hitSlop={4}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: canSend ? coral[500] : coral[100],
          }}
        >
          <SendIcon color={canSend ? "#FFFFFF" : ink[500]} />
        </View>
      </Pressable>
    </View>
  );
}

export default ChatInput;
