import Svg, { Path } from "react-native-svg";

export const PLANE_PATH =
  "M21.426 11.095 4.574 3.36a1 1 0 0 0-1.39 1.18l1.86 5.58a1 1 0 0 0 .77.67l6.19 1.03-6.19 1.03a1 1 0 0 0-.77.67l-1.86 5.58a1 1 0 0 0 1.39 1.18l16.852-7.735a1 1 0 0 0 0-1.81Z";

export function WingMark({ size = 24, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={PLANE_PATH} fill={color} />
    </Svg>
  );
}
