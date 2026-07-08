import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { Avatar } from "../ui/Avatar";
import { coral, ink, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";

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

function PencilIcon({ size = 13, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 20l0.9-4 10.4-10.4a1.5 1.5 0 0 1 2.1 0l1 1a1.5 1.5 0 0 1 0 2.1L8 19.1 4 20z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
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

  function handleEditPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEditPress?.();
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[4], flexShrink: 1 }}>
        <View>
          <Avatar name={name} imageUri={avatarUri} size={72} />
          <Pressable
            onPress={handleEditPress}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              width: 26,
              height: 26,
              borderRadius: radii.pill,
              backgroundColor: coral[500],
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: surface.cream,
            }}
          >
            <PencilIcon />
          </Pressable>
        </View>
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
  );
}

export default ProfileHeader;
