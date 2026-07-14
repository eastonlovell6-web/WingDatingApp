// lib/chat.ts
import { supabase } from "./supabase";

export async function sendMessage(
  chatId: string,
  content: string
): Promise<{ messageId: string; createdAt: string }> {
  const { data, error } = await supabase.functions.invoke<{ messageId: string; createdAt: string }>(
    "send-message",
    { body: { chatId, content } }
  );
  if (error) throw error;
  return data!;
}
