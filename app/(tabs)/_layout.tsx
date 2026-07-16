import { Tabs } from "expo-router";
import { TabBar } from "../../components/home/TabBar";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="intros" />
      <Tabs.Screen name="chats" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="discover" options={{ href: null }} />
      <Tabs.Screen name="invite" options={{ href: null }} />
    </Tabs>
  );
}
