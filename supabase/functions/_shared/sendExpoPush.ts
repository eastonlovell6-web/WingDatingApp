import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function sendPushToUser(
  admin: SupabaseClient,
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<void> {
  const { data: row } = await admin
    .from("push_tokens")
    .select("expo_push_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row?.expo_push_token) {
    return;
  }

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ to: row.expo_push_token, title, body, data }),
  });
}
