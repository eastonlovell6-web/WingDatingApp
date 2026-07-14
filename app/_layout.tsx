import "../global.css";

import { useEffect, useState } from "react";
import { useAuthStore } from "../store/auth";
import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";
import {
  registerForPushNotificationsAsync,
  routeForNotificationData,
  type WingNotificationData,
} from "../lib/notifications";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DevNav } from "../components/dev/DevNav";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from "@expo-google-fonts/bricolage-grotesque";
import {
  DMSans_400Regular,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import {
  DMMono_400Regular,
  DMMono_500Medium,
} from "@expo-google-fonts/dm-mono";

// Keep the splash up until fonts are ready — the whole UI is type-driven, so
// rendering before the families load would flash system fonts (FOUT).
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const user = useAuthStore((s) => s.user);

  // Custom fonts can't vary by `fontWeight` on native — each weight is its own
  // family. These keys are the family names referenced in constants/typography.ts
  // and tailwind.config.js. Keep all three in sync.
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque: BricolageGrotesque_700Bold,
    "BricolageGrotesque-SemiBold": BricolageGrotesque_600SemiBold,
    DMSans: DMSans_400Regular,
    "DMSans-Medium": DMSans_600SemiBold,
    "DMSans-Bold": DMSans_700Bold,
    DMMono: DMMono_400Regular,
    "DMMono-Medium": DMMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
      useAuthStore.getState().initialize();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (user) {
      registerForPushNotificationsAsync(user.id).catch((err) =>
        console.warn("push registration failed", err)
      );
    }
  }, [user]);

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as WingNotificationData;
      const path = routeForNotificationData(data);
      if (path) router.push(path);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as WingNotificationData;
      const path = routeForNotificationData(data);
      if (path) router.push(path);
    });
    return () => subscription.remove();
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen
              name="matchmaker/select"
              options={{ presentation: "modal", animation: "slide_from_bottom" }}
            />
          </Stack>
          {__DEV__ && <DevNav />}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
