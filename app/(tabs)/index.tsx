import { ScrollView, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeHeader } from "../../components/home/HomeHeader";
import { IntroFeed } from "../../components/home/IntroFeed";
import { FriendsRow } from "../../components/home/FriendsRow";
import { MOCK_INTROS } from "../../components/intro/mockIntros";
import { MOCK_FRIENDS } from "../../components/home/friendsMock";
import { TAB_BAR_CLEARANCE } from "../../components/home/TabBar";
import { useAuthStore } from "../../store/auth";
import { getUserProfile } from "../../lib/supabase";
import { surface } from "../../constants/colors";
import { spacing } from "../../constants/spacing";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);
  const { data: profile, isLoading } = useQuery({
    queryKey: ["userProfile", userId],
    queryFn: () => getUserProfile(userId!),
    enabled: !!userId,
  });
  // The app only ever addresses people by first name (see intro-note copy) —
  // `name` in the users table holds the full "First Last" string.
  const name = profile?.name?.split(" ")[0];

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing[4],
          // Reserve the full floating tab bar + FAB overhang, plus breathing
          // room, so the FriendsRow never sits underneath the FAB.
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE + spacing[4],
          paddingHorizontal: spacing[6],
          gap: spacing[8],
        }}
      >
        <HomeHeader name={name} loading={!!userId && isLoading} />
        <IntroFeed intros={MOCK_INTROS} />
        <FriendsRow friends={MOCK_FRIENDS} />
      </ScrollView>
    </View>
  );
}
