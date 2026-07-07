import { useEffect, useRef } from "react";
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { coral, ink, surface } from "../../constants/colors";
import { fonts, textStyles } from "../../constants/typography";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

function ChevronLeft() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke={ink[500]}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function StepDots({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 6, justifyContent: "center" }}>
      {[0, 1, 2, 3].map((i) => (
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

interface NameStepProps {
  firstName: string;
  onFirstNameChange: (name: string) => void;
  lastName: string;
  onLastNameChange: (name: string) => void;
  onBack: () => void;
  onContinue: () => void;
  isSaving?: boolean;
}

export function NameStep({
  firstName,
  onFirstNameChange,
  lastName,
  onLastNameChange,
  onBack,
  onContinue,
  isSaving,
}: NameStepProps) {
  const insets = useSafeAreaInsets();
  const firstNameRef = useRef<TextInput>(null);
  const lastNameRef = useRef<TextInput>(null);

  // Nothing else on this screen to look at first — pop the keyboard as soon
  // as the entrance transition settles (same delay verify.tsx uses for the
  // same reason: focusing mid-transition gets swallowed on iOS).
  useEffect(() => {
    const focusTimer = setTimeout(() => firstNameRef.current?.focus(), 300);
    return () => clearTimeout(focusTimer);
  }, []);

  const canContinue = Boolean(firstName.trim() && lastName.trim());

  function handleContinue() {
    if (canContinue && !isSaving) onContinue();
  }

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        {/* Top bar — back to the intent screen, step dots centered */}
        <View
          style={{
            paddingTop: insets.top + 16,
            paddingHorizontal: 24,
            paddingBottom: 24,
            justifyContent: "center",
          }}
        >
          <StepDots step={0} />
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={{ position: "absolute", left: 24, top: insets.top + 13 }}
          >
            <ChevronLeft />
          </Pressable>
        </View>

        <View style={{ flex: 1, paddingHorizontal: 24 }}>
          <Animated.View entering={FadeInUp.duration(260).delay(80)}>
            <Text style={{ ...textStyles.eyebrow, marginBottom: 8 }}>Step 1 of 4</Text>
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
              What should we call you?
            </Text>
            <Text style={{ ...textStyles.caption, marginBottom: 24 }}>
              This is how friends will introduce you.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(260).delay(140)} style={{ gap: 12 }}>
            <Input
              ref={firstNameRef}
              value={firstName}
              onChangeText={onFirstNameChange}
              placeholder="First name"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => lastNameRef.current?.focus()}
            />
            <Input
              ref={lastNameRef}
              value={lastName}
              onChangeText={onLastNameChange}
              placeholder="Last name"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleContinue}
            />
          </Animated.View>
        </View>

        {/* Pinned bottom CTA — no skip option, entering a name is required */}
        <View
          style={{
            paddingHorizontal: 24,
            paddingBottom: insets.bottom + 24,
            paddingTop: 12,
          }}
        >
          <Button
            title="Continue"
            onPress={handleContinue}
            disabled={!canContinue || isSaving}
            loading={isSaving}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export default NameStep;
