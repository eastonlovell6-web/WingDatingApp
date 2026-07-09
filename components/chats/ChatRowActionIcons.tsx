import Svg, { Line, Path } from "react-native-svg";

interface ActionIconProps {
  size?: number;
  color?: string;
}

export function MuteIcon({ size = 22, color = "#FFFFFF" }: ActionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 9v6h4l5 5V4L8 9H4Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Line x1={16} y1={8} x2={21} y2={16} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={21} y1={8} x2={16} y2={16} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function ArchiveIcon({ size = 22, color = "#FFFFFF" }: ActionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6h16v3H4V6Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M5.5 9V18a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Line x1={10} y1={12.5} x2={14} y2={12.5} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function TrashIcon({ size = 22, color = "#FFFFFF" }: ActionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 7h14" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
