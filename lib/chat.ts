// lib/chat.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import type { Message } from "../components/chat/mockMessages";
import type { ChatPreview } from "../components/chats/mockChats";

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

// Unfiltered on purpose — RLS (messages_select_participant) restricts
// delivery to the subscriber's own chats, so this only ever fires for
// messages the caller is allowed to see. Used by the Chats tab to know
// when to invalidate its list query; the payload itself is unused.
export function subscribeToInbox(onInsert: () => void): () => void {
  const channel = supabase
    .channel("messages:inbox")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => onInsert())
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Two-step fetch (chats+introductions, then users by id) matching
 * getSentIntroductions' convention in lib/introductions.ts. No explicit
 * `.eq()` scoping the caller's own chats — chats_select_participant (RLS)
 * already restricts rows to chats the caller participates in as either
 * user_a_id or user_b_id, a condition that isn't expressible as a single
 * column filter anyway.
 */
export async function getChats(userId: string): Promise<ChatPreview[]> {
  const { data: chats, error } = await supabase
    .from("chats")
    .select("id, created_at, introductions ( matchmaker_id, user_a_id, user_b_id )")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (chats ?? []) as unknown as Array<{
    id: string;
    created_at: string;
    introductions: { matchmaker_id: string; user_a_id: string; user_b_id: string } | null;
  }>;

  const chatIds = rows.map((c) => c.id);
  const userIds = Array.from(
    new Set(
      rows.flatMap((c) => {
        if (!c.introductions) return [];
        const otherId = c.introductions.user_a_id === userId ? c.introductions.user_b_id : c.introductions.user_a_id;
        return [otherId, c.introductions.matchmaker_id];
      })
    )
  );

  const { data: users, error: usersError } =
    userIds.length > 0
      ? await supabase.from("users").select("id, name, photos").in("id", userIds)
      : { data: [], error: null };
  if (usersError) throw usersError;
  const userById = new Map((users ?? []).map((u) => [u.id, u]));

  const { data: messages, error: messagesError } =
    chatIds.length > 0
      ? await supabase
          .from("messages")
          .select("chat_id, sender_id, content, created_at")
          .in("chat_id", chatIds)
          .order("created_at", { ascending: true })
      : { data: [], error: null };
  if (messagesError) throw messagesError;

  const messagesByChat = new Map<string, Array<{ sender_id: string; content: string; created_at: string }>>();
  for (const m of messages ?? []) {
    const list = messagesByChat.get(m.chat_id) ?? [];
    list.push(m);
    messagesByChat.set(m.chat_id, list);
  }

  const lastViewedMap = await readLastViewedMap();

  return rows
    .flatMap((c) => {
      const intro = c.introductions;
      if (!intro) return [];

      const otherId = intro.user_a_id === userId ? intro.user_b_id : intro.user_a_id;
      const other = userById.get(otherId);
      const matchmaker = userById.get(intro.matchmaker_id);
      const chatMessages = messagesByChat.get(c.id) ?? [];
      const lastMessage = chatMessages[chatMessages.length - 1];
      const lastViewed = lastViewedMap[c.id];
      const unreadMessages = chatMessages.filter((m) => m.sender_id !== userId);
      const unreadCount = lastViewed
        ? unreadMessages.filter((m) => m.created_at > lastViewed).length
        : unreadMessages.length;

      const preview: ChatPreview = {
        id: c.id,
        matchName: other?.name ?? "Someone",
        matchAvatarUri: other?.photos?.[0] ?? undefined,
        lastMessage: lastMessage?.content ?? "Say hi to get things started!",
        lastMessageAt: lastMessage?.created_at ?? c.created_at,
        introducedByName: matchmaker?.name?.split(" ")[0] ?? "a friend",
        unreadCount,
      };
      return [preview];
    })
    .sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1));
}
