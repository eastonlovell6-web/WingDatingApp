# Chats Unread Badges + Swipe Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Chats tab, replace each row's plain unread dot with a coral pill badge showing the unread count (plus heavier timestamp/preview text on unread rows), and add swipe-left-to-reveal Mute / Archive / Delete row actions with native drag physics.

**Architecture:** `ChatRow.tsx` stays presentational (row content + unread styling) and gains a required `onPress` prop instead of owning navigation itself. A new `SwipeableChatRow.tsx` wraps `ChatRow` in `react-native-gesture-handler`'s `Swipeable`, owns navigation/haptics/single-open coordination, and renders the three action buttons (icons from a new `ChatRowActionIcons.tsx`). `ChatList.tsx` becomes the coordinator: it holds the "currently open row" ref shared across rows, and wraps each item in a Reanimated `layout`/`exiting` node so Archive/Delete removals animate the list. `ChatsScreen` lifts `MOCK_CHATS` into local state so removal actually updates the UI.

**Tech Stack:** React Native, Expo Router, `react-native-gesture-handler`'s `Swipeable` (already wired via the root `GestureHandlerRootView` in `app/_layout.tsx`), `react-native-reanimated` (`FadeIn`, `FadeOut`, `LinearTransition`, existing `FadeInDown`/`SlideInLeft`), `react-native-svg`, `expo-haptics`, TypeScript strict mode.

## Global Constraints

- Keep files under 500 lines (CLAUDE.md).
- Do what has been asked; nothing more, nothing less — implement exactly `docs/superpowers/specs/2026-07-09-chats-swipe-actions-design.md`, no extra states or persistence.
- Default to no comments; only add one where the WHY is non-obvious.
- No new color tokens — Mute uses `butter[700]`, Archive uses `ink[700]`, Delete uses `coral[600]` (all existing tokens in `constants/colors.ts`), per the approved spec.
- Never put visual styles (background color, etc.) directly on a `Pressable` — put them on an inner `View`/`Animated.View`, matching the existing `Button.tsx` pattern. Styling a `Pressable` directly silently fails to paint on-device in this app.
- No automated test framework exists in this repo (confirmed: no `.test.` files, no jest/testing-library in `package.json`). Verification is `npm run typecheck` (`tsc --noEmit`) plus a manual run-through per task.
- Swipe/pan gesture behavior does not render reliably in the RN-Web preview (known project gotcha) — the final manual check for swipe behavior (Task 4 onward) must happen via `npx expo start` on iOS/Android simulator or device, not the web preview. Typecheck remains the gate for every task; the gesture-specific manual check is called out where it applies.
- After this implementation, update `CLAUDE.md`'s File Structure table per its own Self-Maintenance Rule (Task 6).

---

## File Structure

- **Modify:** `components/chats/mockChats.ts` — `ChatPreview.unread: boolean` → `ChatPreview.unreadCount: number`.
- **Modify:** `components/chats/ChatRow.tsx` — unread badge + weight bump; becomes pure presentational, takes `onPress` prop instead of owning `router.push`/haptics.
- **Create:** `components/chats/ChatRowActionIcons.tsx` — `MuteIcon`, `ArchiveIcon`, `TrashIcon` (line-art SVGs matching `components/ui/TabGlyphs.tsx`'s style).
- **Create:** `components/chats/SwipeableChatRow.tsx` — wraps `ChatRow` in `Swipeable`; owns navigation, haptics, single-open coordination, mute/archive/delete handlers, and the three action buttons.
- **Modify:** `components/chats/ChatList.tsx` — owns the shared "open row" ref, wraps each row in a `layout`/`exiting` `Animated.View` for removal animation, passes `onRemoveChat` down.
- **Modify:** `app/(tabs)/chats.tsx` — lifts `MOCK_CHATS` into `useState` so Archive/Delete actually remove rows.
- **Modify:** `CLAUDE.md` — File Structure table update (Task 6).

---

### Task 1: Unread count badge on `ChatRow`

**Files:**
- Modify: `components/chats/mockChats.ts`
- Modify: `components/chats/ChatRow.tsx`

**Interfaces:**
- Produces: `ChatPreview.unreadCount: number` (replaces `unread: boolean`; `0` = read).
- Produces: `ChatRow`'s unread-driven styling (badge visibility, font weights) now reads `chat.unreadCount > 0` instead of `chat.unread`.

- [ ] **Step 1: Update the data model in `mockChats.ts`**

Change the interface and the three mock entries:

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

// Throwaway fixture data until chats (accepted introductions) are wired to Supabase.
export const MOCK_CHATS: ChatPreview[] = [
  {
    id: "1",
    matchName: "Priya Nair",
    matchAvatarUri: "https://i.pravatar.cc/300?img=47",
    lastMessage: "Okay that settles it, we HAVE to go to that taco place this weekend",
    lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    introducedByName: "Jordan",
    unreadCount: 3,
  },
  {
    id: "2",
    matchName: "Sam Rivera",
    matchAvatarUri: "https://i.pravatar.cc/300?img=12",
    lastMessage: "Haha yes exactly, I still can't believe you've heard of that band",
    lastMessageAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    introducedByName: "Maya",
    unreadCount: 0,
  },
  {
    id: "3",
    matchName: "Grace Lin",
    lastMessage: "Sounds good, talk soon!",
    lastMessageAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    introducedByName: "Noah",
    unreadCount: 0,
  },
];
```

- [ ] **Step 2: Update `ChatRow.tsx`'s unread visuals**

Replace the dot badge and bump timestamp/preview weight. Full new contents of `components/chats/ChatRow.tsx`:

```tsx
import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Avatar } from "../ui/Avatar";
import { TruncatedText } from "../ui/TruncatedText";
import { coral, ink, plum, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { formatRelativeTime } from "../../lib/format";
import type { ChatPreview } from "./mockChats";

interface ChatRowProps {
  chat: ChatPreview;
  index: number;
  onPress: () => void;
}

const spring = { mass: 0.4, damping: 12, stiffness: 220 };

// Quick, tight succession with a small rise — deliberately faster and
// shallower than the Intros list's slower FadeInDown so the two tabs don't
// feel like copies of each other.
const ROW_STAGGER_MS = 45;
const ROW_ENTER_DURATION_MS = 160;
const UNREAD_BADGE_MAX = 9;

export function ChatRow({ chat, index, onPress }: ChatRowProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const firstName = chat.matchName.split(" ")[0];
  const rowDelay = index * ROW_STAGGER_MS;
  const isUnread = chat.unreadCount > 0;
  const weightedFont = isUnread ? fonts.bodyMedium : fonts.body;

  return (
    <Pressable
      onPressIn={() => (scale.value = withSpring(0.98, spring))}
      onPressOut={() => (scale.value = withSpring(1, spring))}
      onPress={onPress}
    >
      {/* Entrance (`entering`) lives on this outer node and the press-scale
          (`useAnimatedStyle`) on the inner one, matching the pattern already
          used for Intros. Note: `.withInitialValues()` on an entering
          animation forces Reanimated's web layer into a permanent
          `position: absolute`, collapsing this row's height in its
          flex-column parent — stick to the built-in offset here. */}
      <Animated.View entering={FadeInDown.duration(ROW_ENTER_DURATION_MS).delay(rowDelay)}>
        <Animated.View
          style={[
            {
              flexDirection: "row",
              gap: spacing[4],
              backgroundColor: surface.paper,
              borderRadius: radii.md,
              padding: spacing[4],
              shadowColor: shadowTint,
              shadowOpacity: 1,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 3,
            },
            animatedStyle,
          ]}
        >
          <Avatar name={chat.matchName} imageUri={chat.matchAvatarUri} size={56} />

          <View style={{ flex: 1, gap: spacing[2] }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[2] }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
                <Text
                  style={{
                    fontFamily: isUnread ? fonts.bodyBold : fonts.bodyMedium,
                    fontSize: fontSize.base[0],
                    color: ink[900],
                  }}
                  numberOfLines={1}
                >
                  {firstName}
                </Text>
                {isUnread && (
                  <Animated.View
                    entering={FadeIn.duration(220).delay(rowDelay + 260)}
                    style={{
                      minWidth: 20,
                      height: 20,
                      paddingHorizontal: 6,
                      borderRadius: radii.pill,
                      backgroundColor: coral[500],
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontFamily: fonts.bodyBold, fontSize: fontSize["2xs"][0], color: "#FFFFFF" }}>
                      {chat.unreadCount > UNREAD_BADGE_MAX ? `${UNREAD_BADGE_MAX}+` : chat.unreadCount}
                    </Text>
                  </Animated.View>
                )}
              </View>
              <Text style={{ fontFamily: weightedFont, fontSize: fontSize.sm[0], color: ink[500] }}>
                {formatRelativeTime(chat.lastMessageAt)}
              </Text>
            </View>

            <TruncatedText
              style={{ fontFamily: weightedFont, fontSize: fontSize.sm[0], color: ink[500] }}
              numberOfLines={1}
            >
              {chat.lastMessage}
            </TruncatedText>

            <Animated.View entering={SlideInLeft.duration(220).delay(rowDelay + 200)}>
              <Text
                style={{
                  fontFamily: fonts.monoMedium,
                  fontSize: fontSize["2xs"][0],
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: plum[500],
                }}
                numberOfLines={1}
              >
                ↳ Introduced by {chat.introducedByName}
              </Text>
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export default ChatRow;
```

Note this removes the `expo-router` and `expo-haptics` imports and the old `handlePress` — navigation/haptics move to `SwipeableChatRow` in Task 3. `ChatRow` is temporarily unrenderable on its own until Task 2 updates its only call site (`ChatList.tsx`); that's fixed within this same task.

- [ ] **Step 3: Fix the now-broken call site so the app still compiles**

`components/chats/ChatList.tsx` currently renders `<ChatRow key={chat.id} chat={chat} index={index} />` with no `onPress` — this will fail typecheck after Step 2. Temporarily pass a no-op inline so Task 1 is independently verifiable; Task 4 replaces this with the real `SwipeableChatRow` wiring. Change the map in `components/chats/ChatList.tsx`:

```tsx
{chats.map((chat, index) => (
  <ChatRow key={chat.id} chat={chat} index={index} onPress={() => {}} />
))}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Manual check**

Run: `npx expo start` (web preview is sufficient for this task — no gestures involved), open the Chats tab.
Expected: Priya Nair's row shows a coral "3" pill badge (not a dot) next to her name, and her timestamp + preview line render visibly bolder than Sam Rivera's and Grace Lin's (which show no badge).

- [ ] **Step 6: Commit**

```bash
git add components/chats/mockChats.ts components/chats/ChatRow.tsx components/chats/ChatList.tsx
git commit -m "feat: add unread count badge and weight bump to chat rows"
```

---

### Task 2: Action icons

**Files:**
- Create: `components/chats/ChatRowActionIcons.tsx`

**Interfaces:**
- Produces: `MuteIcon({ size?: number; color?: string }): JSX.Element`, `ArchiveIcon({ size?: number; color?: string }): JSX.Element`, `TrashIcon({ size?: number; color?: string }): JSX.Element` — each defaults to `size=22`, `color="#FFFFFF"`.

- [ ] **Step 1: Write the icons**

Create `components/chats/ChatRowActionIcons.tsx`:

```tsx
import Svg, { Line, Path } from "react-native-svg";

interface ActionIconProps {
  size?: number;
  color?: string;
}

export function MuteIcon({ size = 22, color = "#FFFFFF" }: ActionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 9v6h4l5 5V4L8 9H4Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Line x1={16} y1={8} x2={21} y2={16} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={21} y1={8} x2={16} y2={16} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function ArchiveIcon({ size = 22, color = "#FFFFFF" }: ActionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6h16v3H4V6Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M5.5 9V18a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Line x1={10} y1={12.5} x2={14} y2={12.5} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function TrashIcon({ size = 22, color = "#FFFFFF" }: ActionIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 7h14" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/chats/ChatRowActionIcons.tsx
git commit -m "feat: add mute/archive/delete icons for chat row swipe actions"
```

---

### Task 3: `SwipeableChatRow` — swipe gesture, actions, single-open coordination

**Files:**
- Create: `components/chats/SwipeableChatRow.tsx`

**Interfaces:**
- Consumes: `ChatRow({ chat, index, onPress }: { chat: ChatPreview; index: number; onPress: () => void })` (Task 1). `MuteIcon`/`ArchiveIcon`/`TrashIcon` (Task 2). `ChatPreview` type from `./mockChats`.
- Produces: `SwipeableChatRow({ chat, index, openRowRef, onRemove }: { chat: ChatPreview; index: number; openRowRef: React.MutableRefObject<Swipeable | null>; onRemove: (id: string) => void }): JSX.Element` — `openRowRef` is a single ref shared by every row in the list (created by `ChatList` in Task 4) so opening one row closes whichever was previously open. `onRemove(chat.id)` is called on Archive or Delete; Mute just closes the row.

- [ ] **Step 1: Write `SwipeableChatRow.tsx`**

```tsx
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";

import { ChatRow } from "./ChatRow";
import { ArchiveIcon, MuteIcon, TrashIcon } from "./ChatRowActionIcons";
import { butter, coral, ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import type { ChatPreview } from "./mockChats";

const ACTION_WIDTH = 70;
const ACTIONS_TOTAL_WIDTH = ACTION_WIDTH * 3;

interface SwipeableChatRowProps {
  chat: ChatPreview;
  index: number;
  openRowRef: React.MutableRefObject<Swipeable | null>;
  onRemove: (id: string) => void;
}

export function SwipeableChatRow({ chat, index, openRowRef, onRemove }: SwipeableChatRowProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const [isOpen, setIsOpen] = useState(false);

  function handleWillOpen() {
    if (openRowRef.current && openRowRef.current !== swipeableRef.current) {
      openRowRef.current.close();
    }
    openRowRef.current = swipeableRef.current;
  }

  function handleClose() {
    setIsOpen(false);
    if (openRowRef.current === swipeableRef.current) {
      openRowRef.current = null;
    }
  }

  function handleRowPress() {
    if (isOpen) {
      swipeableRef.current?.close();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/chat/${chat.id}` as never);
  }

  function handleMute() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    swipeableRef.current?.close();
  }

  function handleArchive() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRemove(chat.id);
  }

  function handleDelete() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRemove(chat.id);
  }

  return (
    <Swipeable
      ref={swipeableRef}
      friction={1}
      overshootRight={false}
      rightThreshold={ACTIONS_TOTAL_WIDTH / 2}
      animationOptions={{ speed: 20, bounciness: 0 }}
      onSwipeableWillOpen={handleWillOpen}
      onSwipeableOpen={() => setIsOpen(true)}
      onSwipeableClose={handleClose}
      renderRightActions={() => (
        <View style={{ flexDirection: "row" }}>
          <ActionButton label="Mute" color={butter[700]} onPress={handleMute}>
            <MuteIcon />
          </ActionButton>
          <ActionButton label="Archive" color={ink[700]} onPress={handleArchive}>
            <ArchiveIcon />
          </ActionButton>
          <ActionButton label="Delete" color={coral[600]} onPress={handleDelete}>
            <TrashIcon />
          </ActionButton>
        </View>
      )}
    >
      <ChatRow chat={chat} index={index} onPress={handleRowPress} />
    </Swipeable>
  );
}

function ActionButton({
  label,
  color,
  onPress,
  children,
}: {
  label: string;
  color: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={{ width: ACTION_WIDTH }}>
      <View
        style={{
          flex: 1,
          backgroundColor: color,
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        {children}
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize["2xs"][0], color: "#FFFFFF" }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export default SwipeableChatRow;
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (`SwipeableChatRow` isn't rendered anywhere yet — Task 4 wires it in — so this only validates the file compiles in isolation.)

- [ ] **Step 3: Commit**

```bash
git add components/chats/SwipeableChatRow.tsx
git commit -m "feat: add SwipeableChatRow with mute/archive/delete swipe actions"
```

---

### Task 4: Wire `SwipeableChatRow` into the list, animate removal

**Files:**
- Modify: `components/chats/ChatList.tsx`
- Modify: `app/(tabs)/chats.tsx`

**Interfaces:**
- Consumes: `SwipeableChatRow` (Task 3).
- Produces: `ChatList({ chats, onRemoveChat }: { chats: ChatPreview[]; onRemoveChat: (id: string) => void }): JSX.Element`. `ChatsScreen` now owns `chats` as local state instead of rendering the static `MOCK_CHATS` import directly.

- [ ] **Step 1: Rewrite `ChatList.tsx`**

```tsx
import { useRef } from "react";
import { View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import Animated, { FadeOut, LinearTransition } from "react-native-reanimated";
import { EmptyChatsState } from "./EmptyChatsState";
import { SwipeableChatRow } from "./SwipeableChatRow";
import type { ChatPreview } from "./mockChats";
import { spacing } from "../../constants/spacing";

interface ChatListProps {
  chats: ChatPreview[];
  onRemoveChat: (id: string) => void;
}

export function ChatList({ chats, onRemoveChat }: ChatListProps) {
  const openRowRef = useRef<Swipeable | null>(null);

  if (chats.length === 0) {
    return <EmptyChatsState />;
  }

  return (
    <View style={{ gap: spacing[4] }}>
      {chats.map((chat, index) => (
        <Animated.View
          key={chat.id}
          layout={LinearTransition.duration(220)}
          exiting={FadeOut.duration(180)}
        >
          <SwipeableChatRow chat={chat} index={index} openRowRef={openRowRef} onRemove={onRemoveChat} />
        </Animated.View>
      ))}
    </View>
  );
}

export default ChatList;
```

- [ ] **Step 2: Lift chats into state in `app/(tabs)/chats.tsx`**

Full new contents:

```tsx
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatList } from "../../components/chats/ChatList";
import { MOCK_CHATS } from "../../components/chats/mockChats";
import { TAB_BAR_CLEARANCE } from "../../components/home/TabBar";
import { ChatsGlyph } from "../../components/ui/TabGlyphs";
import { ink, plum, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const [chats, setChats] = useState(MOCK_CHATS);
  const hasChats = chats.length > 0;

  function handleRemoveChat(id: string) {
    setChats((prev) => prev.filter((chat) => chat.id !== id));
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

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual check (native — web preview does not reliably render pan gestures)**

Run: `npx expo start`, open on iOS or Android simulator (or device), go to the Chats tab.

Verify:
- Dragging a row left tracks the finger 1:1 and stops exactly at 210px (can't overshoot further).
- Releasing past ~105px (half the actions width) snaps the row fully open with a quick, non-bouncy settle; releasing short of that snaps it closed.
- Opening a second row while one is open closes the first automatically.
- Tapping an open row's content closes it without navigating to the chat thread.
- Tapping a closed row still navigates to `/chat/[id]` as before.
- Tapping Mute closes the row (no row removal).
- Tapping Archive or Delete removes that row from the list with a fade, and the rows below it slide up smoothly to close the gap.

- [ ] **Step 5: Commit**

```bash
git add components/chats/ChatList.tsx app/\(tabs\)/chats.tsx
git commit -m "feat: wire swipeable chat rows into the list with animated removal"
```

---

### Task 5: `CLAUDE.md` self-maintenance update

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- None (documentation only).

- [ ] **Step 1: Update the `/components/chats` row in the File Structure table**

In `CLAUDE.md`, find the line:

```
  /chats               — ChatList, ChatRow, EmptyChatsState, mockChats (Chats tab: list of active conversations)
```

Replace it with:

```
  /chats               — ChatList (owns shared open-row ref + removal animation), ChatRow (presentational, takes `onPress`), SwipeableChatRow (Swipeable wrapper: navigation, haptics, single-open coordination, Mute/Archive/Delete actions), ChatRowActionIcons (Mute/Archive/Delete line icons), EmptyChatsState, mockChats (`unreadCount: number`) (Chats tab: list of active conversations)
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document SwipeableChatRow and chat row unread-count changes"
```
