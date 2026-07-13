import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Without an explicit handler, notifications fired while the app is
// foregrounded don't show a banner on current Expo SDKs.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type WingNotificationData =
  | { type: "intro"; introId: string }
  | { type: "intro_accepted" }
  | { type: "message"; chatId: string }
  | { type: "intro_request" };

/**
 * Push copy for the message-notification path. Wing always names the
 * person, never generic "new message" language — mirrors the intro-note
 * copy rule ("Maya thinks you two should meet"). The Edge Function
 * (supabase/functions/_shared/notificationCopy.ts) is the actual runtime
 * source of the push body — this stays hand-synced with it.
 */
export function formatMessageNotification(senderFirstName: string) {
  return {
    title: senderFirstName,
    body: `${senderFirstName} sent you a message`,
  };
}

/**
 * Requests push permission, gets an Expo push token, and upserts it into
 * `push_tokens`. No-ops if no EAS project id is configured yet (app.json /
 * eas.json don't set one as of this writing) — getExpoPushTokenAsync
 * requires one and would throw otherwise.
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<void> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    return;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    return;
  }

  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });

  const { error } = await supabase
    .from("push_tokens")
    .upsert(
      { user_id: userId, expo_push_token: expoPushToken, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (error) {
    throw error;
  }
}

/** Maps a notification's data payload to the screen it should open. */
export function routeForNotificationData(data: WingNotificationData): string {
  switch (data.type) {
    case "intro":
      return `/intro/${data.introId}`;
    case "message":
      return `/chat/${data.chatId}`;
    case "intro_accepted":
      return "/(tabs)/intros";
    case "intro_request":
      return "/(tabs)";
  }
}
