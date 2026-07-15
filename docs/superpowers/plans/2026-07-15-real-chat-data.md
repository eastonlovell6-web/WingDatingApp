# Real Chat Data (Chats Tab + Chat Thread) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the chat pipeline real end-to-end: accepting an introduction creates a real `chats` row, the Chats tab lists real chats with live previews, and the chat thread shows real message history with realtime delivery — replacing `MOCK_CHATS`/`MOCK_MESSAGES` entirely.

**Architecture:** Fix the root-cause gap (no `chats` row is ever created on accept) in `respond-to-introduction`. Add read/realtime/local-storage functions to `lib/chat.ts`. Swap the two screens' mock imports for React Query + Supabase Realtime, leaving all existing presentational components (`ChatRow`, `MessageBubble`, `ChatInput`, swipe actions) untouched.

**Tech Stack:** Expo/React Native + TypeScript, Supabase (Postgres + Realtime + Edge Functions), `@tanstack/react-query`, Zustand (`useAuthStore`), `@react-native-async-storage/async-storage` (new dependency).

## Global Constraints

- No `read_at` column, ever, anywhere — unread counts are computed entirely on-device from local "last viewed" timestamps, never written back to Supabase or shared with the other participant.
- `respond-to-introduction`'s chat-creation insert must never turn a successful accept into a non-2xx response — log and continue, matching the existing push-notification pattern in that file.
- `chats.intro_id` must have a unique constraint so a retried insert can never produce two chats for one introduction.
- Empty-chat preview copy is "Say hi to get things started!" — never algorithmic copy like "You matched!" (voice/tone rule in CLAUDE.md).
- TypeScript strict mode is always on. Run `npm run typecheck` after every task that touches `.ts`/`.tsx` files and confirm zero errors before moving on.
- SQL is hand-applied via the Supabase SQL Editor and Edge Functions are hand-deployed (`supabase/functions/*` has no CI deploy step) — this project's established convention. **Applying SQL or running `supabase functions deploy` touches the live, shared Supabase project. Confirm with the user before running either — do not do so autonomously**, even though `npx supabase` is available and the project is linked in this environment.
- No test framework exists in this repo (no Jest, no test files anywhere) — verification is `npm run typecheck` plus the manual/headless-browser checks in Task 6, matching this codebase's established practice, not unit tests.

---

### Task 1: Add AsyncStorage dependency

**Files:**
- Modify: `package.json` (via `expo install`, not hand-edited)

**Interfaces:**
- Produces: `@react-native-async-storage/async-storage`, importable as `import AsyncStorage from "@react-native-async-storage/async-storage"`, consumed by Task 4.

- [ ] **Step 1: Install the package with the Expo-managed installer**

Run: `npx expo install @react-native-async-storage/async-storage`
Expected: `package.json` gains a new dependency line for `@react-native-async-storage/async-storage`, pinned to the version Expo SDK 54 expects; install completes with no peer-dependency errors.

- [ ] **Step 2: Verify the project still typechecks**

Run: `npm run typecheck`
Expected: no errors (this step only adds a dependency, no code references it yet).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add AsyncStorage for local chat-unread tracking"
```

---

### Task 2: SQL migration — chat uniqueness, realtime, grants

**Files:**
- Create: `supabase/sql/005_chats_realtime.sql`

**Interfaces:**
- Produces (once hand-applied to the live project — see Task 6): `chats.intro_id` unique constraint; `messages` added to the `supabase_realtime` publication; `authenticated` granted `SELECT` on `chats` and `messages`. Tasks 3, 4, and 5 depend on all three being applied before they'll work against the live database, but the file itself has no code dependency and can be written and committed now.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/sql/005_chats_realtime.sql
-- Hand-apply in the Supabase SQL Editor (see 001_notifications_schema.sql —
-- this project has no migrations folder).
--
-- Three independent fixes needed for real chat data:
--
-- 1. `chats.intro_id` gets a unique constraint. respond-to-introduction
--    inserts a chat row right after an intro is accepted; if that insert
--    is ever retried (e.g. a manual re-run after a transient failure),
--    this constraint guarantees it can never produce two chats for one
--    introduction.
--
-- 2. `messages` is added to the `supabase_realtime` publication. Without
--    this, postgres_changes subscriptions never fire, regardless of RLS.
--    RLS (messages_select_participant, already in 001) continues to scope
--    which rows each subscriber actually receives.
--
-- 3. Explicit SELECT grants on `chats` and `messages` for `authenticated`.
--    Both tables were created via raw SQL in 001, not the Studio Table
--    Editor — the same gap that broke onboarding for `friendships` (see
--    004_grant_friendships_select.sql). RLS policies alone don't grant
--    table-level privileges; without this, every client read against
--    these two tables fails with "permission denied," independent of RLS.

alter table chats add constraint chats_intro_id_unique unique (intro_id);

alter publication supabase_realtime add table messages;

grant select on public.chats to authenticated;
grant select on public.messages to authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/sql/005_chats_realtime.sql
git commit -m "feat: add SQL migration for real chat data (uniqueness, realtime, grants)"
```

(Applying this file to the live Supabase project happens in Task 6, with explicit confirmation.)

---

### Task 3: Fix chat creation in `respond-to-introduction`

**Files:**
- Modify: `supabase/functions/respond-to-introduction/index.ts`

**Interfaces:**
- Consumes: `chats.intro_id` unique constraint (Task 2, once applied).
- Produces: when `newStatus === "accepted"`, a `chats` row with `intro_id = introId` — the data source Tasks 4 and 5 read from.

- [ ] **Step 1: Read the current file to find the exact insertion point**

The relevant block (inside the `if (newStatus === "accepted")` branch, right before the push notification) currently reads:

```ts
    if (newStatus === "accepted") {
      const { title, body } = formatIntroAcceptedNotification();
      // The status is already committed at this point — push delivery is
      // best-effort and must never turn a successful status update into a
      // failure response.
      try {
        await sendPushToUser(admin, intro.matchmaker_id, title, body, { type: "intro_accepted" });
      } catch (pushError) {
        console.warn("respond-to-introduction: push delivery failed", pushError);
      }
    }
```

- [ ] **Step 2: Insert chat creation before the push-notification block**

Replace that block with:

```ts
    if (newStatus === "accepted") {
      // Chat creation must never turn a successful accept into a failure
      // response — respondToIntroduction's client retry only handles a
      // 409 conflict, and a second call after this point reads
      // status === "accepted" and 409s with "already resolved," which
      // isn't a conflict the retry logic knows how to resolve. A rare
      // insert failure here becomes a to-be-healed-manually gap, not a
      // stuck user. chats.intro_id is unique (005_chats_realtime.sql), so
      // a retried insert can never produce a duplicate chat.
      const { error: chatError } = await admin.from("chats").insert({ intro_id: introId });
      if (chatError) {
        console.warn("respond-to-introduction: chat creation failed", chatError);
      }

      const { title, body } = formatIntroAcceptedNotification();
      // The status is already committed at this point — push delivery is
      // best-effort and must never turn a successful status update into a
      // failure response.
      try {
        await sendPushToUser(admin, intro.matchmaker_id, title, body, { type: "intro_accepted" });
      } catch (pushError) {
        console.warn("respond-to-introduction: push delivery failed", pushError);
      }
    }
```

- [ ] **Step 3: Verify by reading the full file back**

There is no Deno runtime in this environment to run `deno check` against Edge Function source, so verification here is a careful read-back: confirm the `admin.from("chats").insert(...)` call sits inside the `newStatus === "accepted"` branch, after the CAS-guarded status update has already succeeded, and before the `return`. Full functional verification happens in Task 6, after deployment.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/respond-to-introduction/index.ts
git commit -m "fix: create a chats row when an introduction is accepted"
```

(Deploying this function to the live project happens in Task 6, with explicit confirmation.)

---

### Task 4: Chat thread — real data, realtime, unread tracking

**Files:**
- Modify: `components/chat/mockMessages.ts`
- Modify: `components/chat/MessageBubble.tsx`
- Modify: `lib/chat.ts`
- Modify: `app/chat/[id].tsx`

**Interfaces:**
- Consumes: `AsyncStorage` (Task 1); `chats`/`messages` tables readable + realtime-enabled (Task 2, once applied); `chats` rows existing for accepted intros (Task 3).
- Produces (in `lib/chat.ts`, alongside the existing `sendMessage`):
  - `getMessages(chatId: string): Promise<Message[]>`
  - `subscribeToMessages(chatId: string, onInsert: (message: Message) => void): () => void`
  - `getChatHeader(chatId: string, userId: string): Promise<{ matchName: string; matchAvatarUri?: string } | null>`
  - `getLastViewed(chatId: string): Promise<string | null>`
  - `setLastViewed(chatId: string): Promise<void>`
  - `Message.senderId` is now the real sender's Supabase auth uuid (was `"me" | "them"`).
  - Consumed by Task 5's `getChats`, which reuses the same file's private `readLastViewedMap` helper.

- [ ] **Step 1: Update the shared `Message` type and drop the mock array**

Replace the full contents of `components/chat/mockMessages.ts` with:

```ts
export interface Message {
  id: string;
  chatId: string;
  senderId: string; // Supabase auth user id — real data comes from lib/chat.ts's getMessages
  content: string;
  createdAt: string; // ISO
}
```

- [ ] **Step 2: Update `MessageBubble` to take `isMine` as a prop**

Replace the full contents of `components/chat/MessageBubble.tsx` with:

```tsx
import { Text, View } from "react-native";
import { coral, ink, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import type { Message } from "./mockMessages";

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
}

export function MessageBubble({ message, isMine }: MessageBubbleProps) {
  return (
    <View style={{ alignItems: isMine ? "flex-end" : "flex-start", marginBottom: spacing[2] }}>
      <View
        style={{
          maxWidth: "78%",
          backgroundColor: isMine ? coral[500] : surface.paper,
          borderRadius: radii.lg,
          borderBottomRightRadius: isMine ? radii.sm : radii.lg,
          borderBottomLeftRadius: isMine ? radii.lg : radii.sm,
          paddingHorizontal: spacing[4],
          paddingVertical: 10,
          shadowColor: shadowTint,
          shadowOpacity: isMine ? 0 : 1,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: isMine ? 0 : 2,
        }}
      >
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.base[0],
            lineHeight: fontSize.base[1],
            color: isMine ? "#FFFFFF" : ink[900],
          }}
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
}

export default MessageBubble;
```

- [ ] **Step 3: Add the thread-related data functions to `lib/chat.ts`**

Replace the full contents of `lib/chat.ts` with:

```ts
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
```

- [ ] **Step 4: Wire the chat thread screen to real data**

Replace the full contents of `app/chat/[id].tsx` with:

```tsx
import { useEffect } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Svg, { Path } from "react-native-svg";
import { Avatar } from "../../components/ui/Avatar";
import { MessageBubble } from "../../components/chat/MessageBubble";
import { ChatInput } from "../../components/chat/ChatInput";
import type { Message } from "../../components/chat/mockMessages";
import { useAuthStore } from "../../store/auth";
import { getChatHeader, getMessages, sendMessage, setLastViewed, subscribeToMessages } from "../../lib/chat";
import { ink, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 8 12l7 7" stroke={ink[900]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const { data: header } = useQuery({
    queryKey: ["chatHeader", id],
    queryFn: () => getChatHeader(id!, userId!),
    enabled: !!id && !!userId,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", id],
    queryFn: () => getMessages(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (!id) return;
    setLastViewed(id).catch((err) => console.warn("failed to mark chat viewed", err));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribeToMessages(id, (message) => {
      queryClient.setQueryData<Message[]>(["messages", id], (prev = []) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message]
      );
      setLastViewed(id).catch((err) => console.warn("failed to mark chat viewed", err));
    });
  }, [id, queryClient]);

  function handleSend(content: string) {
    if (!id || !userId) return;
    const tempId = `local-${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      chatId: id,
      senderId: userId,
      content,
      createdAt: new Date().toISOString(),
    };
    queryClient.setQueryData<Message[]>(["messages", id], (prev = []) => [...prev, optimisticMessage]);

    sendMessage(id, content)
      .then(({ messageId, createdAt }) => {
        queryClient.setQueryData<Message[]>(["messages", id], (prev = []) => {
          const withoutTemp = prev.filter((m) => m.id !== tempId);
          if (withoutTemp.some((m) => m.id === messageId)) return withoutTemp;
          return [...withoutTemp, { ...optimisticMessage, id: messageId, createdAt }];
        });
      })
      .catch((err) => console.warn("failed to send message", err));
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: surface.cream }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing[4],
          paddingTop: insets.top + spacing[2],
          paddingBottom: spacing[4],
          paddingHorizontal: spacing[4],
          backgroundColor: surface.paper,
          shadowColor: shadowTint,
          shadowOpacity: 1,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        <Pressable onPress={() => router.canGoBack() && router.back()} hitSlop={8}>
          <BackIcon />
        </Pressable>
        <Avatar name={header?.matchName ?? "?"} imageUri={header?.matchAvatarUri} size={40} />
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.lg[0], color: ink[900] }}>
          {header?.matchName?.split(" ")[0] ?? "Chat"}
        </Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MessageBubble message={item} isMine={item.senderId === userId} />}
        contentContainerStyle={{ padding: spacing[4], flexGrow: 1, justifyContent: "flex-end" }}
      />

      <ChatInput onSend={handleSend} bottomInset={insets.bottom} />
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors. `app/(tabs)/chats.tsx` isn't touched until Task 5, but nothing in this task changes anything it depends on, so the whole project should typecheck cleanly here too.

- [ ] **Step 6: Commit**

```bash
git add components/chat/mockMessages.ts components/chat/MessageBubble.tsx lib/chat.ts app/chat/\[id\].tsx
git commit -m "feat: wire chat thread screen to real Supabase data and realtime"
```

---

### Task 5: Chats tab — real data, realtime, local unread state

**Files:**
- Modify: `components/chats/mockChats.ts`
- Modify: `lib/chat.ts`
- Modify: `app/(tabs)/chats.tsx`

**Interfaces:**
- Consumes: `getMessages`/`readLastViewedMap` pattern established in Task 4 (same file); `chats` rows existing for accepted intros (Task 3).
- Produces: `getChats(userId: string): Promise<ChatPreview[]>`, `subscribeToInbox(onInsert: () => void): () => void` in `lib/chat.ts`.

- [ ] **Step 1: Drop the mock array, keep the shared type**

Replace the full contents of `components/chats/mockChats.ts` with:

```ts
export interface ChatPreview {
  id: string;
  matchName: string;
  matchAvatarUri?: string;
  lastMessage: string;
  lastMessageAt: string; // ISO
  introducedByName: string;
  unreadCount: number;
}

// Real data comes from lib/chat.ts's getChats.
```

- [ ] **Step 2: Add `getChats` and `subscribeToInbox` to `lib/chat.ts`**

Add the following import to the top of `lib/chat.ts` (alongside the existing `Message` import):

```ts
import type { ChatPreview } from "../components/chats/mockChats";
```

Then append this to the end of `lib/chat.ts`:

```ts

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

  const rows = (chats ?? []) as Array<{
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
```

- [ ] **Step 3: Wire the Chats tab screen to real data**

Replace the full contents of `app/(tabs)/chats.tsx` with:

```tsx
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChatList } from "../../components/chats/ChatList";
import { TAB_BAR_CLEARANCE } from "../../components/home/TabBar";
import { ChatsGlyph } from "../../components/ui/TabGlyphs";
import { useAuthStore } from "../../store/auth";
import { getChats, subscribeToInbox } from "../../lib/chat";
import { ink, plum, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  const { data: allChats = [] } = useQuery({
    queryKey: ["chats", userId],
    queryFn: () => getChats(userId!),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;
    return subscribeToInbox(() => {
      queryClient.invalidateQueries({ queryKey: ["chats", userId] });
    });
  }, [userId, queryClient]);

  const chats = allChats.filter((chat) => !removedIds.has(chat.id));
  const hasChats = chats.length > 0;

  function handleRemoveChat(id: string) {
    setRemovedIds((prev) => new Set(prev).add(id));
  }

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing[4],
          paddingBottom: insets.bottom + TAB_BAR_CLEARANCE + spacing[4],
          paddingHorizontal: spacing[6],
          gap: spacing[6],
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ChatsGlyph size={20} color={plum[600]} />
          <Text
            style={{
              fontFamily: fonts.displaySemibold,
              fontSize: fontSize.xl[0],
              lineHeight: fontSize.xl[1],
              color: ink[900],
            }}
          >
            Chats
          </Text>
        </View>

        <ChatList chats={chats} onRemoveChat={handleRemoveChat} />

        {hasChats && (
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: fontSize.sm[0],
              lineHeight: fontSize.sm[1],
              color: ink[500],
              textAlign: "center",
            }}
          >
            Everyone on this list said yes twice — once to the idea, once to the person.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 4: Typecheck the whole project**

Run: `npm run typecheck`
Expected: no errors anywhere in the project. This confirms `mockChats.ts`'s removal of `MOCK_CHATS` has no remaining consumers and that `mockMessages.ts`'s removal of `MOCK_MESSAGES` (Task 4) has none either.

- [ ] **Step 5: Confirm no remaining references to the removed mock exports**

Run: `grep -rn "MOCK_CHATS\|MOCK_MESSAGES" app components lib --include="*.ts" --include="*.tsx"`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add components/chats/mockChats.ts lib/chat.ts "app/(tabs)/chats.tsx"
git commit -m "feat: wire Chats tab to real Supabase data and realtime"
```

---

### Task 6: Deploy and verify end-to-end

**Files:** none (deployment + manual verification only)

**Interfaces:** none — this task validates Tasks 2–5 against the live project.

- [ ] **Step 1: Confirm with the user before touching the live project**

Before running anything in this task, explicitly confirm with the user that it's OK to apply `005_chats_realtime.sql` and deploy `respond-to-introduction` to the live Supabase project (project ref `wgtebnwbkfmlhuwjnkjo`, linked via `supabase/.temp/`). Do not proceed without that confirmation.

- [ ] **Step 2: Apply the SQL migration**

Paste the contents of `supabase/sql/005_chats_realtime.sql` into the Supabase Studio SQL Editor and run it (matching how `001`–`004` were applied — this project has no migrations folder). Confirm it completes with no errors. If `npx supabase db push` is preferred instead, confirm that with the user first since it applies to the same live database.

- [ ] **Step 3: Deploy the updated Edge Function**

Run: `npx supabase functions deploy respond-to-introduction`
Expected: deploy succeeds with no errors.

- [ ] **Step 4: Drive a real introduction to `accepted` and confirm a chat is created**

Since `app/intro/[id].tsx` still renders `MOCK_INTROS` (documented, pre-existing, out of scope — see the design spec), there's no UI path to a real accept yet. Verify directly instead: using two seeded test user accounts, call `send-introduction` to create a real `introductions` row, then call `respond-to-introduction` with `{ introId, response: "accept" }` as each of the two participants in turn (via `supabase.functions.invoke` from a scratch script, or `curl` against the deployed function URL with each user's JWT). After the second accept returns `{ "status": "accepted" }`, query `select * from chats where intro_id = '<introId>';` in the SQL Editor and confirm exactly one row exists.

- [ ] **Step 5: Verify the Chats tab and chat thread render real data**

Per this project's established RN-Web verification recipe (headless-browser, since no simulator is available in this environment): start the app with `npx expo start --web`, sign in as one of the two test users, open the Chats tab, and confirm the chat created in Step 4 appears with the other participant's real name/photo and "Say hi to get things started!" as the preview. Open the thread, send a message via `ChatInput`, and confirm it appears immediately (optimistic) and persists after a reload (`getMessages` round-trip). Flag realtime delivery and AsyncStorage-persistence-across-restarts as native-only checks still owed on a physical device or simulator, consistent with prior sessions' documented limitation.

- [ ] **Step 6: Confirm unread counts behave correctly**

As the second test user (who hasn't opened the thread yet), confirm the Chats tab shows an unread badge for the new message from Step 5. Open the thread as that user, confirm the badge clears, back out to the Chats tab, and confirm it stays cleared.
