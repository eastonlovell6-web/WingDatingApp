import { useEffect, useState } from "react";
import { Text, TextLayoutEvent, TextProps, View } from "react-native";

interface TruncatedTextProps extends TextProps {
  children: string;
  numberOfLines: number;
}

/**
 * Text preview that always cuts at the end of a full word.
 *
 * RN's native `ellipsizeMode="tail"` truncates by character, not word — once
 * the visible text still overflows the actual render width (long names,
 * larger accessibility font sizes, narrow screens), it clips mid-word. This
 * measures the untruncated layout once (off-screen) and re-renders with the
 * cut moved back to the last full word before the line break.
 */
export function TruncatedText({ children, numberOfLines, style, ...rest }: TruncatedTextProps) {
  const [display, setDisplay] = useState<string | null>(null);

  useEffect(() => {
    setDisplay(null);
  }, [children, numberOfLines]);

  function handleMeasure(e: TextLayoutEvent) {
    if (display !== null) return;
    const { lines } = e.nativeEvent;
    if (lines.length <= numberOfLines) {
      setDisplay(children);
      return;
    }

    const visible = lines
      .slice(0, numberOfLines)
      .map((line) => line.text)
      .join("");
    const lastSpace = visible.trimEnd().lastIndexOf(" ");
    const cut = (lastSpace > 0 ? visible.slice(0, lastSpace) : visible.trimEnd()).trimEnd();
    setDisplay(`${cut}…`);
  }

  return (
    <View>
      <Text style={style} numberOfLines={numberOfLines} ellipsizeMode="tail" {...rest}>
        {display ?? children}
      </Text>
      {display === null && (
        <Text
          style={[style, { position: "absolute", left: 0, right: 0, opacity: 0 }]}
          onTextLayout={handleMeasure}
          {...rest}
        >
          {children}
        </Text>
      )}
    </View>
  );
}

export default TruncatedText;
