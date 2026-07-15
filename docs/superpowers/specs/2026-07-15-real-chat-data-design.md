# Real Chat Data: Chats Tab + Chat Thread

## Summary

Chat is the destination of both Flow 1 (Matchmaker) and Flow 2 (Request).
Today the app can send and accept a real introduction, but the conversation
that follows is entirely fake: the Chats tab renders `MOCK_CHATS`, the chat
thread renders `MOCK_MESSAGES`, and — the actual root cause — no code path
ever inserts a row into the `chats` table, even when an introduction is
accepted for real. This project makes the whole pipeline real: intro
acceptance creates a chat, the Chats tab lists real chats with live-updating
previews, and the chat thread shows real message history with realtime
delivery.

`send-message` (Edge Function) and `lib/chat.ts`'s `sendMessage` already work
correctly against the real schema — this project doesn't touch the write
path, only what was missing around it: chat creation and all reads.

## Known limitation (explicitly out of scope)

`app/intro/[id].tsx` (the Home intro feed) still renders `MOCK_INTROS`, so
today nothing in the UI can drive a real `introductions` row to `accepted`.
This project makes the chat pipeline correct and ready for when that feed is
wired to real data (separate, larger pre-existing gap). Verification here
will drive `introductions`/`respond-to-introduction` directly rather than
through the mock Home screen.

## 1. Chat creation (the actual bug fix)

`supabase/functions/respond-to-introduction/index.ts`: immediately after the
compare-and-swap update lands `status = "accepted"`, insert a `chats` row
(`intro_id: introId`). Wrapped in try/catch, logged with `console.warn` on
failure, and **never turned into a non-2xx response** — the same pattern
already used for push delivery in this file. This is deliberate: the
client's `respondToIntroduction` only retries once and only on a 409; a
500 here would leave the intro accepted-but-unretryable on the client
(second attempt reads `status === "accepted"` and 409s with "already
resolved," which isn't a conflict the retry logic knows how to resolve).
A rare chat-insert failure becomes a to-be-healed-manually gap, not a stuck
user.

**New SQL** — `supabase/sql/005_chats_realtime.sql`:
- `alter table chats add constraint chats_intro_id_unique unique (intro_id);`
  — safety net so a retried/duplicated insert attempt can never produce two
  chats for one introduction.
- `alter publication supabase_realtime add table messages;` — required for
  `postgres_changes` events to fire at all; RLS (`messages_select_participant`,
  already in place) continues to scope which rows each subscriber receives.

## 2. Data layer (`lib/chat.ts`, extended — no new file)

- `getChats(userId): Promise<ChatPreview[]>` — two-step fetch matching the
  existing `friendships.ts`/`introductions.ts` convention: fetch the user's
  chats embedded with their introduction (`chats.intro_id` is a single,
  unambiguous FK, so a PostgREST embed works here without constraint-hint
  syntax); collect the other participant's id + the matchmaker's id from
  each introduction; fetch those users in one batch; fetch all messages for
  the resulting chat ids in one batch. Reduce that last result client-side
  to (a) latest message per chat for the preview/timestamp and (b) unread
  counts (see §3). Chats with no messages yet show "Say hi to get things started!" as the
  preview (voice guideline: avoid algorithmic "You matched!" copy) and the
  chat's `created_at` as the timestamp.
- `getMessages(chatId): Promise<Message[]>` — full history, ascending by
  `created_at`.
- `subscribeToMessages(chatId, onInsert): () => void` — realtime channel
  filtered to `chat_id=eq.${chatId}`, INSERT only. Used by the open thread
  to append incoming messages live.
- `subscribeToInbox(onInsert): () => void` — one realtime channel per
  mounted Chats tab, unfiltered `messages` INSERT (RLS restricts delivery
  to the subscriber's own chats). Used to invalidate the chats query so
  previews/ordering/unread counts stay current without polling.
- `getLastViewed(chatId): Promise<string | null>` /
  `setLastViewed(chatId): Promise<void>` — AsyncStorage, single JSON blob
  under one key (`wing:chatLastViewed`, `Record<chatId, isoTimestamp>`).
  New dependency: `@react-native-async-storage/async-storage`.

`Message.senderId` changes from the mock's `"me" | "them"` literal to the
real sender's uuid. `MessageBubble` derives `isMine` by comparing
`message.senderId` to the authed user's id (via `useAuthStore`) instead of
a literal string compare — its own concern, passed in as a prop rather than
reaching into the store itself, keeping the component presentational.

## 3. Unread counts (no read receipts, still)

Per CLAUDE.md: no `read_at` column, ever, anywhere. Unread counts are
computed entirely on-device and never written back to Supabase or shared
with the other participant — this isn't a read receipt, it's local
bookkeeping for one user's own badge.

For each chat: count messages where `created_at > lastViewed[chatId]` and
`sender_id !== me`. Computed from the same per-chat-ids message batch
`getChats` already fetches for previews (no extra round trip). Opening a
thread (`app/chat/[id].tsx`) calls `setLastViewed(chatId)` on mount and
again each time a realtime message arrives while the thread is open, so
returning to the Chats tab shows that chat as read.

**Known MVP limitation:** `getChats` fetches full message rows (not just
counts) to compute both preview and unread count from one query. Fine at
BYU-beachhead scale; would need a Postgres view/RPC if per-chat message
volume grows large. Noted, not solved here.

## 4. Screens

`ChatsScreen` (`app/(tabs)/chats.tsx`) and `app/chat/[id].tsx` swap their
`MOCK_CHATS`/`MOCK_MESSAGES` imports for `useQuery` against `getChats`/
`getMessages`, wire up the two subscriptions above, and are otherwise
unchanged — `ChatRow`, `SwipeableChatRow`, `ChatList`, `MessageBubble`,
`ChatInput`, and all existing animations/gestures stay exactly as they are.
This is a data-layer swap, not a redesign. Mute/Archive/Delete (from the
2026-07-09 swipe-actions work) remain local-only list state, unchanged —
out of scope here, no backend concept of muted/archived exists yet.

## Testing / verification plan

No simulator available in this environment (per project memory). Plan:
1. Apply `005_chats_realtime.sql` by hand in the Supabase SQL Editor.
2. Manually drive a real `introductions` row to `accepted` (direct Edge
   Function calls against two seeded test users, or a direct SQL update),
   confirming exactly one `chats` row is created and the unique constraint
   holds under a repeated call.
3. Headless-browser (RN-Web) verification of the Chats tab and chat thread
   rendering real data, per the project's existing web-preview recipe —
   flagging any native-only checks (realtime socket behavior, AsyncStorage
   persistence across restarts) as still owed on-device.
4. `npm run build` / typecheck, since `Message.senderId`'s type change
   touches `MessageBubble` and the thread screen.
