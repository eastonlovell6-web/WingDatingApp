import Svg, { Circle, Path } from "react-native-svg";

interface GlyphProps {
  size?: number;
  color: string;
}

// Two overlapping circles — a mutual connection. Shared with the Intros tab
// bar icon so the screen header echoes the exact same shape.
export function IntrosGlyph({ size = 22, color }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={9.5} cy={12} r={6.5} stroke={color} strokeWidth={1.8} />
      <Circle cx={14.5} cy={12} r={6.5} stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

// Speech bubble. Shared with the Chats tab bar icon.
export function ChatsGlyph({ size = 22, color }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5h16v10H8l-4 4V5Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
