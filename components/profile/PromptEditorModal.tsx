import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Path } from "react-native-svg";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { coral, ink, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { PRESET_PROMPT_QUESTIONS } from "./mockProfile";

function ShuffleIcon({ size = 14, color = coral[500] }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 7h3.5L15 17h6M3 17h3.5L11 12M17 7h4M17 7l-3-3M17 7l-3 3M21 17l-3-3M21 17l-3 3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Picks a random preset different from `current`, preferring one not already
// used by another prompt on the profile — falls back to the full bank if
// every other question is somehow already in use.
function pickQuestion(exclude: string[], current?: string): string {
  const withoutCurrent = current
    ? PRESET_PROMPT_QUESTIONS.filter((q) => q !== current)
    : PRESET_PROMPT_QUESTIONS;
  const fresh = withoutCurrent.filter((q) => !exclude.includes(q));
  const pool = fresh.length > 0 ? fresh : withoutCurrent.length > 0 ? withoutCurrent : PRESET_PROMPT_QUESTIONS;
  return pool[Math.floor(Math.random() * pool.length)];
}

interface PromptEditorModalProps {
  visible: boolean;
  initialQuestion?: string;
  initialAnswer?: string;
  usedQuestions?: string[];
  onSave: (question: string, answer: string) => void;
  onRemove?: () => void;
  onClose: () => void;
}

export function PromptEditorModal({
  visible,
  initialQuestion,
  initialAnswer = "",
  usedQuestions = [],
  onSave,
  onRemove,
  onClose,
}: PromptEditorModalProps) {
  const [question, setQuestion] = useState(initialQuestion ?? "");
  const [answer, setAnswer] = useState(initialAnswer);

  // Reset the draft each time the sheet opens for a (possibly different)
  // prompt — a brand-new prompt starts with a random unused question.
  useEffect(() => {
    if (visible) {
      setQuestion(initialQuestion ?? pickQuestion(usedQuestions));
      setAnswer(initialAnswer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialQuestion, initialAnswer]);

  function handleShuffle() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuestion((current) => pickQuestion(usedQuestions, current));
  }

  function handleSave() {
    const trimmedAnswer = answer.trim();
    if (!question || !trimmedAnswer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSave(question, trimmedAnswer);
  }

  function handleRemove() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRemove?.();
  }

  const canSave = question.length > 0 && answer.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(26,20,18,0.45)" }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <Pressable onPress={() => {}}>
            <View
              style={{
                backgroundColor: surface.paper,
                borderTopLeftRadius: radii.xl,
                borderTopRightRadius: radii.xl,
                padding: spacing[6],
                gap: spacing[4],
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text
                  style={{
                    fontFamily: fonts.displaySemibold,
                    fontSize: fontSize.xl[0],
                    lineHeight: fontSize.xl[1],
                    color: ink[900],
                  }}
                >
                  {onRemove ? "Edit prompt" : "Add a prompt"}
                </Text>
                <Pressable onPress={onClose} hitSlop={8}>
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

              <View style={{ gap: spacing[2] }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.sm[0], color: ink[500] }}>
                    Question
                  </Text>
                  <Pressable
                    onPress={handleShuffle}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Shuffle question"
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: radii.pill,
                      borderWidth: 1.5,
                      borderColor: coral[300],
                    }}
                  >
                    <ShuffleIcon />
                    <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.xs[0], color: coral[500] }}>
                      Shuffle
                    </Text>
                  </Pressable>
                </View>
                <View
                  style={{
                    minHeight: 56,
                    justifyContent: "center",
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: ink[200],
                    backgroundColor: surface.cream,
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[2],
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.bodyMedium,
                      fontSize: fontSize.base[0],
                      lineHeight: fontSize.base[1],
                      color: ink[900],
                    }}
                  >
                    {question}
                  </Text>
                </View>
              </View>

              <View style={{ gap: spacing[2] }}>
                <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.sm[0], color: ink[500] }}>
                  Answer
                </Text>
                <Input
                  value={answer}
                  onChangeText={setAnswer}
                  placeholder="Write your answer..."
                  multiline
                  maxLength={200}
                  style={{ height: 100, paddingTop: spacing[2], textAlignVertical: "top" }}
                />
              </View>

              <Button title="Save" onPress={handleSave} disabled={!canSave} style={{ marginTop: spacing[2] }} />

              {onRemove && (
                <Pressable onPress={handleRemove} style={{ alignItems: "center", paddingVertical: spacing[2] }}>
                  <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.base[0], color: coral[600] }}>
                    Remove prompt
                  </Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

export default PromptEditorModal;
