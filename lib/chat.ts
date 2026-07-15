// lib/chat.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import type { Message } from "../components/chat/mockMessages";

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

export async function getMessages(chatId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, chat_id, sender_id, content, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    chatId: m.chat_id,
    senderId: m.sender_id,
    content: m.content,
    createdAt: m.created_at,
  }));
}

export function subscribeToMessages(chatId: string, onInsert: (message: Message) => void): () => void {
  const channel = supabase
    .channel(`messages:chat:${chatId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
      (payload) => {
        const row = payload.new as {
          id: string;
          chat_id: string;
          sender_id: string;
          content: string;
          created_at: string;
        };
        onInsert({
          id: row.id,
          chatId: row.chat_id,
          senderId: row.sender_id,
          content: row.content,
          createdAt: row.created_at,
        });
      }
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export async function getChatHeader(
  chatId: string,
  userId: string
): Promise<{ matchName: string; matchAvatarUri?: string } | null> {
  const { data: chat, error } = await supabase
    .from("chats")
    .select("introductions ( user_a_id, user_b_id )")
    .eq("id", chatId)
    .maybeSingle();
  if (error) throw error;

  const intro = chat?.introductions as unknown as { user_a_id: string; user_b_id: string } | null;
  if (!intro) return null;

  const otherId = intro.user_a_id === userId ? intro.user_b_id : intro.user_a_id;
  const { data: other, error: userError } = await supabase
    .from("users")
    .select("name, photos")
    .eq("id", otherId)
    .maybeSingle();
  if (userError) throw userError;

  return { matchName: other?.name ?? "Someone", matchAvatarUri: other?.photos?.[0] ?? undefined };
}

const LAST_VIEWED_KEY = "wing:chatLastViewed";

async function readLastViewedMap(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(LAST_VIEWED_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function getLastViewed(chatId: string): Promise<string | null> {
  const map = await readLastViewedMap();
  return map[chatId] ?? null;
}

export async function setLastViewed(chatId: string): Promise<void> {
  const map = await readLastViewedMap();
  map[chatId] = new Date().toISOString();
  await AsyncStorage.setItem(LAST_VIEWED_KEY, JSON.stringify(map));
}
