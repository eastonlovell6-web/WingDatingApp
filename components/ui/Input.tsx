import { forwardRef, useState } from "react";
import { Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { coral, ink, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";

interface InputProps extends TextInputProps {
  error?: string;
  containerStyle?: ViewStyle;
}

/**
 * The app's reusable text field. Covers the four design-system states —
 * empty, focused (coral border), filled, error — so future screens don't
 * need to re-derive border/color logic per field.
 */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { error, containerStyle, onFocus, onBlur, value, style, ...rest },
  ref
) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = Boolean(value);

  const borderColor = error
    ? coral[600]
    : isFocused
      ? coral[500]
      : hasValue
        ? ink[700]
        : ink[300];

  return (
    <View style={containerStyle}>
      <TextInput
        ref={ref}
        value={value}
        placeholderTextColor={ink[500]}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        style={[
          {
            height: 56,
            borderRadius: radii.md,
            borderWidth: isFocused || error ? 1.5 : 1,
            borderColor,
            backgroundColor: surface.paper,
            paddingHorizontal: spacing[4],
            fontFamily: fonts.bodyMedium,
            fontSize: fontSize.base[0],
            color: ink[900],
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.sm[0],
            color: coral[600],
            marginTop: spacing[2],
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
});

export default Input;
