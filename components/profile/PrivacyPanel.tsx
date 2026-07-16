import { Alert, Pressable, Switch, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Path } from "react-native-svg";
import { blush, coral, ink, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { useAuthStore } from "../../store/auth";
import type { PrivacySettings } from "./mockProfile";

function ChevronIcon({ size = 18, color = ink[300] }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function GroupCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: surface.paper,
        borderRadius: radii.lg,
        overflow: "hidden",
        shadowColor: shadowTint,
        shadowOpacity: 1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      {children}
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: ink[100], marginLeft: spacing[4] }} />;
}

function NavRow({
  label,
  caption,
  onPress,
  textColor = ink[900],
}: {
  label: string;
  caption?: string;
  onPress?: () => void;
  textColor?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      accessibilityRole="button"
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[4],
        gap: spacing[2],
      }}
    >
      <View style={{ flexShrink: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: fontSize.base[0], color: textColor }}>{label}</Text>
        {caption && (
          <Text style={{ fontFamily: fonts.body, fontSize: fontSize.sm[0], color: ink[500] }}>{caption}</Text>
        )}
      </View>
      <ChevronIcon />
    </Pressable>
  );
}

function ToggleRow({
  label,
  caption,
  value,
  onValueChange,
}: {
  label: string;
  caption?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[4],
        gap: spacing[2],
      }}
    >
      <View style={{ flexShrink: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: fontSize.base[0], color: ink[900] }}>{label}</Text>
        {caption && (
          <Text style={{ fontFamily: fonts.body, fontSize: fontSize.sm[0], color: ink[500] }}>{caption}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={(next) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onValueChange(next);
        }}
        trackColor={{ false: ink[200], true: coral[500] }}
        thumbColor={surface.paper}
      />
    </View>
  );
}

interface PrivacyPanelProps {
  introducersCount: number;
  blockedCount: number;
  settings: PrivacySettings;
  onSettingsChange: (next: PrivacySettings) => void;
  onVisibilityPress?: () => void;
  onBlockedListPress?: () => void;
  onAccountSettingsPress?: () => void;
}

export function PrivacyPanel({
  introducersCount,
  blockedCount,
  settings,
  onSettingsChange,
  onVisibilityPress,
  onBlockedListPress,
  onAccountSettingsPress,
}: PrivacyPanelProps) {
  const signOut = useAuthStore((s) => s.signOut);

  function handleLogOut() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    signOut();
  }

  function handleDeleteAccount() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Delete account",
      "This permanently deletes your profile, matches, and chats. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            // TODO: wire to a real account-deletion Supabase Edge Function.
          },
        },
      ]
    );
  }

  return (
    <View style={{ gap: spacing[6] }}>
      <GroupCard>
        <NavRow
          label="Who can introduce you"
          caption={`${introducersCount} friend${introducersCount === 1 ? "" : "s"} can currently introduce you`}
          onPress={() => {
            // TODO: router.push('/settings/friend-visibility') once that screen exists.
            onVisibilityPress?.();
          }}
        />
      </GroupCard>

      <GroupCard>
        <ToggleRow
          label="Show mutual friend count"
          caption="Let people you're introduced to see how many friends you share"
          value={settings.mutualFriendCountVisible}
          onValueChange={(next) => onSettingsChange({ ...settings, mutualFriendCountVisible: next })}
        />
        <Divider />
        <ToggleRow
          label="Close friends can suggest freely"
          caption="Skip the request step for your closest friends"
          value={settings.closeFriendsCanSuggestFreely}
          onValueChange={(next) => onSettingsChange({ ...settings, closeFriendsCanSuggestFreely: next })}
        />
        <Divider />
        <ToggleRow
          label="Pause new intros"
          caption="Hide yourself from new matchmaker intros and requests"
          value={settings.pausedNewIntros}
          onValueChange={(next) => onSettingsChange({ ...settings, pausedNewIntros: next })}
        />
      </GroupCard>

      <GroupCard>
        <NavRow
          label="Blocked & hidden"
          caption={blockedCount > 0 ? `${blockedCount} people` : "No one blocked or hidden"}
          onPress={() => {
            // TODO: router.push('/settings/blocked') once that screen exists.
            onBlockedListPress?.();
          }}
        />
      </GroupCard>

      <GroupCard>
        <NavRow
          label="Account settings"
          onPress={() => {
            // TODO: router.push('/settings/account') once that screen exists.
            onAccountSettingsPress?.();
          }}
        />
        <Divider />
        <NavRow label="Log out" onPress={handleLogOut} />
      </GroupCard>

      <Pressable
        onPress={handleDeleteAccount}
        accessibilityRole="button"
        accessibilityLabel="Delete account"
        style={{
          height: 52,
          borderRadius: radii.pill,
          backgroundColor: blush[100],
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.base[0], color: coral[600] }}>
          Delete account
        </Text>
      </Pressable>
    </View>
  );
}

export default PrivacyPanel;
