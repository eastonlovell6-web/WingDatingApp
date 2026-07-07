import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeHeader } from "../../components/home/HomeHeader";
import { IntroFeed } from "../../components/home/IntroFeed";
import { FriendsRow } from "../../components/home/FriendsRow";
import { MOCK_INTROS } from "../../components/intro/mockIntros";
import { MOCK_FRIENDS } from "../../components/home/friendsMock";
import { useAuthStore } from "../../store/auth";
import { surface } from "../../constants/colors";
import { spacing } from "../../constants/spacing";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const name = useAuthStore((s) => s.user?.user_metadata?.name as string | undefined);

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing[4],
          paddingBottom: insets.bottom + spacing[10],
          paddingHorizontal: spacing[6],
          gap: spacing[8],
        }}
      >
        <HomeHeader name={name} />
        <IntroFeed intros={MOCK_INTROS} />
        <FriendsRow friends={MOCK_FRIENDS} />
      </ScrollView>
    </View>
  );
}
