import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Line } from "react-native-svg";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

function GearIcon({ size = 22, color = ink[500] }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.8} />
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <Line
          key={angle}
          x1={12 + 7 * Math.cos((angle * Math.PI) / 180)}
          y1={12 + 7 * Math.sin((angle * Math.PI) / 180)}
          x2={12 + 9.5 * Math.cos((angle * Math.PI) / 180)}
          y2={12 + 9.5 * Math.sin((angle * Math.PI) / 180)}
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

interface ProfileHeaderProps {
  name: string;
  meta: string;
  avatarUri?: string;
  onEditPress?: () => void;
  onSettingsPress?: () => void;
}

export function ProfileHeader({ name, meta, avatarUri, onEditPress, onSettingsPress }: ProfileHeaderProps) {
  function handleSettingsPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: router.push('/settings/account') once the Account Settings screen exists.
    onSettingsPress?.();
  }

  return (
    <View style={{ gap: spacing[4] }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[4], flexShrink: 1 }}>
          <Avatar name={name} imageUri={avatarUri} size={72} />
          <View style={{ gap: 2, flexShrink: 1 }}>
            <Text
              style={{
                fontFamily: fonts.displaySemibold,
                fontSize: fontSize["2xl"][0],
                lineHeight: fontSize["2xl"][1],
                letterSpacing: -0.2,
                color: ink[900],
              }}
              numberOfLines={1}
            >
              {name}
            </Text>
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: fontSize.sm[0],
                lineHeight: fontSize.sm[1],
                color: ink[500],
              }}
              numberOfLines={1}
            >
              {meta}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={handleSettingsPress}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Account settings"
          style={{ padding: spacing[2] / 2 }}
        >
          <GearIcon />
        </Pressable>
      </View>

      <Button
        title="Edit profile"
        variant="outline"
        onPress={onEditPress}
        style={{ height: 44, paddingHorizontal: spacing[6], alignSelf: "flex-start" }}
      />
    </View>
  );
}

export default ProfileHeader;
