# Matchmaker Step 1+2 Real Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `MOCK_MATCHMAKER_FRIENDS` and the local-only send in `app/matchmaker/select.tsx` (Step 1) and `app/matchmaker/note.tsx` (Step 2) with real Supabase queries and the already-built `sendIntroduction()` Edge Function call.

**Architecture:** A new `lib/friendships.ts` module exposes `getMatchmakerFriends(userId)`, doing three flat (non-embedded) Supabase queries — `friendships`, `users`, `introductions` — and merging them into the existing `MatchmakerFriend[]` shape. Both screens consume it via the same React Query key (`["matchmakerFriends", userId]`), so Step 2 gets a cache hit from Step 1's navigation in the normal flow. Step 2's send handler awaits the real `sendIntroduction()` (from `lib/introductions.ts`, already built) instead of only writing to the local `useIntrosStore`, and the pre-existing local self-notification block is removed since the Edge Function already pushes to both real recipients server-side.

**Tech Stack:** `@tanstack/react-query` (already a dependency, already used this way in `app/(tabs)/index.tsx`), `@supabase/supabase-js`.

**No test runner exists in this repo** (`package.json` has only `typecheck` and `lint` scripts, no jest/vitest, no `*.test.*` files anywhere — confirmed by search). Every task below uses `npx tsc --noEmit` as the automated correctness gate, per the project's actual convention (see `docs/superpowers/plans/2026-07-13-matchmaker-step-2.md`). The final task includes a manual verification checklist requiring hand-seeded Supabase rows, since no friendship-creation flow exists yet anywhere in the app (confirmed via `app/(auth)/onboarding.tsx`'s `MOCK_FRIENDS` placeholder comment: "Placeholder until contacts-sync + the friendships table are wired up").

## Global Constraints

- Design tokens only from `constants/colors.ts`, `constants/typography.ts`, `constants/spacing.ts` — no new hex values, no magic spacing numbers.
- All imports are relative (`../../constants/colors`), matching every existing file in this repo — no `@/` alias.
- Keep files under 500 lines.
- Do not touch `app/(tabs)/index.tsx` or `app/matchmaker/prompt-friends.tsx` — both stay on `getIntroducibleFriends()`/`MOCK_MATCHMAKER_FRIENDS` from `components/matchmaker/mockMatchmakerFriends.ts`. That module's pure helpers (`getFriendEligibility`, `getIneligibleCaption`, `FriendEligibility`, `MatchmakerFriend` type) are still imported by both this task's files and those two out-of-scope files — do not delete or rename them.
- Never surface a successful "Your intro is on its way" confirmation after a failed send — the 3-pending-intro cap is a listed non-negotiable (CLAUDE.md "Anti-spam limits") and the server enforces it; the client must show that failure, not swallow it.
- Never add a `read_at`-style field or any status the matchmaker firewall forbids.

---

### Task 1: `lib/friendships.ts` data layer

**Files:**
- Create: `lib/friendships.ts`

**Interfaces:**
- Consumes: `supabase` client from `./supabase`; `MatchmakerFriend` type from `../components/matchmaker/mockMatchmakerFriends` (fields: `id, name, imageUri?, canIntroduce, activePendingCount, lookingToGetSetUp`).
- Produces: `getMatchmakerFriends(userId: string): Promise<MatchmakerFriend[]>` — consumed by Task 2 and Task 3.

- [ ] **Step 1: Create `lib/friendships.ts`**

```ts
// lib/friendships.ts
import { supabase } from "./supabase";
import type { MatchmakerFriend } from "../components/matchmaker/mockMatchmakerFriends";

const ACTIVE_INTRO_STATUSES = ["pending_a", "pending_b", "both_pending"];

/**
 * A friendships row's user_id is the friend who granted permission;
 * friend_id is the person allowed to introduce them. So "my friends, with
 * each one's can_introduce setting toward me" is every row where
 * friend_id = the current user.
 */
export async function getMatchmakerFriends(userId: string): Promise<MatchmakerFriend[]> {
  const { data: friendshipRows, error: friendshipsError } = await supabase
    .from("friendships")
    .select("user_id, can_introduce")
    .eq("friend_id", userId);
  if (friendshipsError) throw friendshipsError;

  const friendIds: string[] = (friendshipRows ?? []).map((row) => row.user_id);
  if (friendIds.length === 0) return [];

  const canIntroduceByFriendId = new Map<string, boolean>(
    (friendshipRows ?? []).map((row) => [row.user_id, row.can_introduce])
  );

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, name, photos, role")
    .in("id", friendIds);
  if (usersError) throw usersError;

  // Mirrors supabase/functions/send-introduction/index.ts's countActivePending:
  // two separate queries summed, rather than a single .or() filter.
  const [asA, asB] = await Promise.all([
    supabase
      .from("introductions")
      .select("user_a_id")
      .in("status", ACTIVE_INTRO_STATUSES)
      .in("user_a_id", friendIds),
    supabase
      .from("introductions")
      .select("user_b_id")
      .in("status", ACTIVE_INTRO_STATUSES)
      .in("user_b_id", friendIds),
  ]);
  if (asA.error) throw asA.error;
  if (asB.error) throw asB.error;

  const activePendingCountByFriendId = new Map<string, number>();
  for (const row of asA.data ?? []) {
    activePendingCountByFriendId.set(
      row.user_a_id,
      (activePendingCountByFriendId.get(row.user_a_id) ?? 0) + 1
    );
  }
  for (const row of asB.data ?? []) {
    activePendingCountByFriendId.set(
      row.user_b_id,
      (activePendingCountByFriendId.get(row.user_b_id) ?? 0) + 1
    );
  }

  return (users ?? []).map((user) => ({
    id: user.id,
    name: user.name,
    imageUri: user.photos?.[0] ?? undefined,
    canIntroduce: canIntroduceByFriendId.get(user.id) ?? false,
    activePendingCount: activePendingCountByFriendId.get(user.id) ?? 0,
    lookingToGetSetUp: user.role !== "wing-somebody",
  }));
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/friendships.ts
git commit -m "feat: add getMatchmakerFriends data layer for real friendships"
```

---

### Task 2: Wire `app/matchmaker/select.tsx` (Step 1) to real data

**Files:**
- Modify: `app/matchmaker/select.tsx`

**Interfaces:**
- Consumes: `getMatchmakerFriends` (Task 1), `useAuthStore` from `../../store/auth` (selector `(s) => s.user?.id`), `getFriendEligibility` from `../../components/matchmaker/mockMatchmakerFriends` (unchanged), `useQuery` from `@tanstack/react-query`.
- Produces: nothing consumed elsewhere — this is a route.

- [ ] **Step 1: Replace `app/matchmaker/select.tsx` with the real-data version**

Full new file content:

```tsx
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { FriendPickerGrid } from "../../components/matchmaker/FriendPickerGrid";
import { MatchmakerEncouragementState } from "../../components/matchmaker/MatchmakerEncouragementState";
import { getFriendEligibility } from "../../components/matchmaker/mockMatchmakerFriends";
import { getMatchmakerFriends } from "../../lib/friendships";
import { useAuthStore } from "../../store/auth";
import { coral, ink, surface } from "../../constants/colors";
import { textStyles } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";

const spring = { mass: 0.4, damping: 12, stiffness: 220 };

function XIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6l12 12M18 6 6 18"
        stroke={ink[900]}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function MatchmakerSelectScreen() {
  const { preselect } = useLocalSearchParams<{ preselect?: string }>();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const preselectAppliedRef = useRef(false);

  const userId = useAuthStore((s) => s.user?.id);
  const { data: friends = [], isLoading } = useQuery({
    queryKey: ["matchmakerFriends", userId],
    queryFn: () => getMatchmakerFriends(userId!),
    enabled: !!userId,
  });

  // Runs once, the first time friends data is available, so a background
  // refetch later doesn't stomp on selections the user already made by hand.
  useEffect(() => {
    if (preselectAppliedRef.current || friends.length === 0) return;
    preselectAppliedRef.current = true;
    if (!preselect) return;
    const preselectedFriend = friends.find((f) => f.id === preselect);
    if (preselectedFriend && getFriendEligibility(preselectedFriend) === "eligible") {
      setSelectedIds([preselect]);
    }
  }, [preselect, friends]);

  const eligibleCount = friends.filter((f) => getFriendEligibility(f) === "eligible").length;
  const showEncouragement = !isLoading && eligibleCount < 2;

  const filteredFriends = friends.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedFriends = selectedIds.map((id) => friends.find((f) => f.id === id)!);
  const canContinue = selectedIds.length === 2;

  const buttonScale = useSharedValue(1);
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  useEffect(() => {
    if (canContinue) {
      buttonScale.value = withSequence(withSpring(1.06, spring), withSpring(1, spring));
    }
  }, [canContinue, buttonScale]);

  function handleToggle(friendId: string) {
    setSelectedIds((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  }

  function handleContinue() {
    if (!canContinue) return;
    router.push(
      `/matchmaker/note?friendAId=${selectedIds[0]}&friendBId=${selectedIds[1]}` as never
    );
  }

  function handleInvitePress() {
    // TODO: hand off to the Invite flow once it exists (same stub convention
    // as FriendsRow.handleFriendPress / HomeHeader's unwired onInvitePress).
    console.log("[matchmaker/select] invite friends tapped");
  }

  const headline = selectedIds.length === 0 ? "Who should meet?" : "Nice. Who's their match?";
  const continueLabel = canContinue
    ? `Continue with ${selectedFriends[0].name.split(" ")[0]} & ${selectedFriends[1].name.split(" ")[0]}`
    : "Continue";

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: surface.cream,
        borderTopLeftRadius: radii["2xl"],
        borderTopRightRadius: radii["2xl"],
        overflow: "hidden",
        paddingTop: insets.top,
      }}
    >
      <View style={{ alignItems: "center", paddingTop: spacing[2] }}>
        <View style={{ width: 40, height: 5, borderRadius: radii.pill, backgroundColor: ink[300] }} />
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing[6],
          paddingTop: spacing[4],
        }}
      >
        <Pressable
          onPress={() => router.canGoBack() && router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <XIcon />
        </Pressable>
        <Text style={textStyles.eyebrow}>STEP 1 OF 2</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={coral[500]} />
        </View>
      ) : showEncouragement ? (
        <MatchmakerEncouragementState
          onInvitePress={handleInvitePress}
          onNotNowPress={() => router.canGoBack() && router.back()}
        />
      ) : (
        <>
          <View style={{ paddingHorizontal: spacing[6], paddingTop: spacing[6], gap: spacing[2] }}>
            <Text style={textStyles.heading}>{headline}</Text>
            <Text style={textStyles.caption}>Pick two friends you think would click.</Text>
          </View>

          <View style={{ paddingHorizontal: spacing[6], paddingTop: spacing[6] }}>
            <Input
              placeholder="Search friends"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: spacing[6],
              paddingTop: spacing[6],
              paddingBottom: spacing[4],
            }}
            showsVerticalScrollIndicator={false}
          >
            <FriendPickerGrid friends={filteredFriends} selectedIds={selectedIds} onToggle={handleToggle} />
          </ScrollView>

          <View
            style={{
              paddingHorizontal: spacing[6],
              paddingTop: spacing[4],
              paddingBottom: insets.bottom + spacing[4],
              borderTopWidth: 1,
              borderTopColor: ink[200],
            }}
          >
            <Animated.View style={buttonAnimatedStyle}>
              <Button title={continueLabel} onPress={handleContinue} disabled={!canContinue} />
            </Animated.View>
          </View>
        </>
      )}
    </View>
  );
}
```

Note: `showEncouragement` (`eligibleCount < 2`) already covers the true
zero-friends case — an account with no `friendships` rows has
`eligibleCount === 0`, so it falls into the same existing
`MatchmakerEncouragementState` ("Matchmaking takes two (of your friends)...
Invite friends to Wing") rather than needing a second, near-duplicate empty
state. This is simpler than the original spec's "distinct empty state" and
serves the same intent — no separate component needed.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/matchmaker/select.tsx
git commit -m "feat: wire Matchmaker Step 1 friend picker to real friendships data"
```

---

### Task 3: Wire `app/matchmaker/note.tsx` (Step 2) to the real send, verify end-to-end

**Files:**
- Modify: `app/matchmaker/note.tsx`

**Interfaces:**
- Consumes: `getMatchmakerFriends` (Task 1), `sendIntroduction(userAId: string, userBId: string, note: string): Promise<string>` from `../../lib/introductions` (already exists, unmodified), `useAuthStore`, `useIntrosStore` (unmodified, `sendIntro(friendA, friendB, note)`).
- Produces: nothing consumed elsewhere — this is a route.

- [ ] **Step 1: Replace `app/matchmaker/note.tsx` with the real-send version**

Full new file content:

```tsx
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../../components/ui/Button";
import { SelectedPairHeader } from "../../components/matchmaker/SelectedPairHeader";
import { NoteComposerCard } from "../../components/matchmaker/NoteComposerCard";
import { SendConfirmationOverlay } from "../../components/matchmaker/SendConfirmationOverlay";
import { getMatchmakerFriends } from "../../lib/friendships";
import { sendIntroduction } from "../../lib/introductions";
import { useAuthStore } from "../../store/auth";
import { useIntrosStore } from "../../store/intros";
import { coral, ink, surface } from "../../constants/colors";
import { fonts, textStyles } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";

function XIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6l12 12M18 6 6 18"
        stroke={ink[900]}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function MatchmakerNoteScreen() {
  const { friendAId, friendBId } = useLocalSearchParams<{ friendAId?: string; friendBId?: string }>();
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const userId = useAuthStore((s) => s.user?.id);
  const { data: friends = [] } = useQuery({
    queryKey: ["matchmakerFriends", userId],
    queryFn: () => getMatchmakerFriends(userId!),
    enabled: !!userId,
  });

  const friendA = friends.find((f) => f.id === friendAId);
  const friendB = friends.find((f) => f.id === friendBId);

  // Malformed/direct deep link with no matching friends — not reachable via
  // the app's own navigation (select.tsx only ever passes eligible ids), so
  // this just backs out rather than showing a dedicated error state. Gated
  // on friends.length > 0 so this doesn't fire while the query is still
  // loading (friendA/friendB are legitimately undefined until then).
  useEffect(() => {
    if (friends.length > 0 && (!friendA || !friendB)) {
      router.canGoBack() && router.back();
    }
  }, [friends, friendA, friendB]);

  if (!friendA || !friendB) {
    return null;
  }

  const canSend = note.trim().length > 0;

  async function handleSend() {
    if (confirming || sending || !friendA || !friendB || !canSend) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    setSendError(null);
    try {
      await sendIntroduction(friendA.id, friendB.id, note.trim());
      // Temporary bridge: the Intros tab (sent-history list) is still
      // mock-backed, out of scope for this task. Keeping this optimistic
      // append preserves "my just-sent intro shows up there" continuity
      // until that tab gets its own real-data wiring.
      useIntrosStore.getState().sendIntro(friendA, friendB, note.trim());
      setConfirming(true);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Couldn't send that intro. Try again.");
    } finally {
      setSending(false);
    }
  }

  function handleConfirmationDismiss() {
    setConfirming(false);
    router.dismissTo("/(tabs)" as never);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{
        flex: 1,
        backgroundColor: surface.cream,
        borderTopLeftRadius: radii["2xl"],
        borderTopRightRadius: radii["2xl"],
        overflow: "hidden",
        paddingTop: insets.top,
      }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing[6] }}
      >
        <View style={{ alignItems: "center", paddingTop: spacing[2] }}>
          <View style={{ width: 40, height: 5, borderRadius: radii.pill, backgroundColor: ink[300] }} />
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing[6],
            paddingTop: spacing[4],
          }}
        >
          <Pressable
            onPress={() => router.canGoBack() && router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <XIcon />
          </Pressable>
          <Text style={textStyles.eyebrow}>STEP 2 OF 2</Text>
        </View>

        <View style={{ paddingHorizontal: spacing[6], paddingTop: spacing[6], gap: spacing[2] }}>
          <Text style={textStyles.heading}>Write the intro</Text>
          <Text style={textStyles.caption}>A short note goes a long way.</Text>
        </View>

        <View style={{ paddingHorizontal: spacing[6], paddingTop: spacing[6] }}>
          <SelectedPairHeader friendA={friendA} friendB={friendB} />
        </View>

        <View style={{ paddingHorizontal: spacing[6], paddingTop: spacing[6] }}>
          <NoteComposerCard value={note} onChangeText={setNote} />
        </View>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: spacing[6],
          paddingTop: spacing[4],
          paddingBottom: insets.bottom + spacing[4],
          borderTopWidth: 1,
          borderTopColor: ink[200],
        }}
      >
        {sendError && (
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: 14,
              lineHeight: 20,
              color: coral[500],
              textAlign: "center",
              marginBottom: spacing[2],
            }}
          >
            {sendError}
          </Text>
        )}
        <Button
          title="Send intro"
          onPress={handleSend}
          disabled={!canSend || confirming}
          loading={sending}
        />
      </View>

      <SendConfirmationOverlay visible={confirming} onDismiss={handleConfirmationDismiss} />
    </KeyboardAvoidingView>
  );
}
```

This removes the entire local self-notification block (`expo-notifications`
permission dance + `scheduleNotificationAsync`) and its now-unused imports
(`expo-notifications`, `MOCK_MATCHMAKER_FRIENDS`, `MOCK_PROFILE_USER`,
`formatIntroNotification`) — the Edge Function
(`supabase/functions/send-introduction/index.ts`) already pushes to both
real recipients server-side via `sendPushToUser`, so the old client-side
call was notifying the sender about their own action and duplicating the
real push.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Seed test data in the Supabase SQL Editor**

For two test accounts already created via phone auth in this project (call
their `auth.users`/`public.users` ids `A` and `B`), plus a third existing
user `C`:

```sql
insert into friendships (user_id, friend_id, can_introduce) values
  ('<B-id>', '<A-id>', true),
  ('<C-id>', '<A-id>', true);
```

This makes B and C show up as eligible friends on A's Matchmaker Step 1.

- [ ] **Step 4: Manual end-to-end verification**

Run: `npx expo start --web` (or `--ios`/`--android` if a simulator/device is
available), signed in as account A.

1. Tap the coral FAB → Step 1 opens, shows a brief spinner, then shows B and
   C as eligible friend chips (not the old fixture names like "Sam Rivera").
2. Select B and C → Continue → Step 2 opens with `SelectedPairHeader`
   showing B and C's real names/avatars.
3. Type a note → tap "Send intro" — the button shows its built-in loading
   spinner while the request is in flight.
4. On success: confirmation card ("Your intro is on its way") appears, then
   dismisses to Home after ~1.5s. In the Supabase dashboard, confirm a new
   `introductions` row exists with `status = both_pending`,
   `matchmaker_id = A`, `user_a_id = B`, `user_b_id = C`, and the note text.
5. Confirm no local notification fires on A's own device (the old
   placeholder behavior) — B and C's devices (if registered for push, per
   the already-merged push notifications feature) receive the real push
   instead.
6. In the SQL Editor, insert 3 pre-existing active-status `introductions`
   rows involving B (`status` any of `pending_a`/`pending_b`/`both_pending`),
   then repeat steps 1–3 selecting B again. Confirm the inline error text
   ("One of these people already has the maximum of 3 pending intros")
   appears below the Send button instead of the confirmation overlay, and
   the screen stays put with Send re-enabled.
7. Switch to the Intros tab — the just-sent intro from step 4 still appears
   at the top of the (still mock-backed) sent list, confirming the temporary
   `useIntrosStore` bridge wasn't broken by this change.

- [ ] **Step 5: Commit**

```bash
git add app/matchmaker/note.tsx
git commit -m "feat: wire Matchmaker Step 2 to the real sendIntroduction Edge Function"
```
