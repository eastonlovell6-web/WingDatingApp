import { Text, View } from "react-native";

// Placeholder root route so the app boots. Replaced when the Onboarding
// screen is built (screen #1 in the build order — see CLAUDE.md).
export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-cream">
      <Text className="text-ink-900 text-lg">Wing — scaffold ready</Text>
    </View>
  );
}
