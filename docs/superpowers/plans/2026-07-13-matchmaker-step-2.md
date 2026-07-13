# Matchmaker Step 2 (Write Note + Send) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `app/matchmaker/note.tsx` so the Matchmaker flow's Step 1 (`select.tsx`, already built) has somewhere to go — write an intro note, send it, see a confirmation, and have that send show up in the Intros tab plus fire a simulated local push notification.

**Architecture:** A new screen (`app/matchmaker/note.tsx`) reads the two friend IDs Step 1 already passes via route params, composed from three new presentational components (`SelectedPairHeader`, `NoteComposerCard`, `SendConfirmationOverlay`). Sending calls a new small Zustand store (`store/intros.ts`) that both this screen and the existing Intros tab / Profile screen read from, so the send is visible immediately without a reload. A local (not server-sent) push notification simulates the recipient experience, since friends are still fixture data with no real devices to push to.

**Tech Stack:** Expo Router (file-based routing, existing `presentation: "modal"` sheet), Zustand, React Native Reanimated, `expo-haptics`, `expo-notifications` (already a dependency, first real use).

**No test runner exists in this repo** (`package.json` has only `typecheck` and `lint` scripts, no jest/vitest, no `*.test.*` files anywhere). Every task below substitutes `npx tsc --noEmit` as the automated correctness gate, per the project's actual convention. The final two tasks also include a manual verification checklist — run these by hand (`npx expo start`, exercise the flow) since no automated UI test exists to do it for you.

## Global Constraints

- Design tokens only from `constants/colors.ts`, `constants/typography.ts`, `constants/spacing.ts`, `constants/elevation.ts` — no new hex values, no magic spacing numbers.
- All imports are relative (`../../constants/colors`), matching every existing file in this repo — no `@/` alias, even though `tsconfig.json` defines one.
- Copy: "Your intro is on its way" (send confirmation) and "{Name} thinks you two should meet" (push notification body) are exact strings from CLAUDE.md — do not paraphrase.
- Never add a `read_at`-style field or any status the matchmaker firewall forbids (see CLAUDE.md Privacy Rules) — `SentIntro.status` stays `"pending" | "matched"` only, unchanged.
- Keep files under 500 lines.
- `MatchmakerFriend` (id/name/imageUri/canIntroduce/activePendingCount/lookingToGetSetUp) has no `age` or `tagline` — do not reuse `TwoPersonHeader` (which requires those fields); it belongs to the Intro Detail screen's different concern.

---

### Task 1: Notification helper + foreground handler

**Files:**
- Modify: `lib/notifications.ts`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Produces: `formatIntroNotification(matchmakerFirstName: string): { title: string; body: string }` — consumed by Task 6.

- [ ] **Step 1: Add `formatIntroNotification` to `lib/notifications.ts`**

Full new file content:

```ts
/**
 * Push copy for the message-notification path (not yet wired to a Supabase
 * Edge Function). Wing always names the person, never generic "new message"
 * language — mirrors the intro-note copy rule ("Maya thinks you two should meet").
 */
export function formatMessageNotification(senderFirstName: string) {
  return {
    title: senderFirstName,
    body: `${senderFirstName} sent you a message`,
  };
}

/**
 * Push copy for the Matchmaker send flow (Flow 1, step 3). Simulated with a
 * local notification today since introductions aren't written to Supabase
 * and friends have no real push tokens yet — same fixture-only convention as
 * the rest of the app. Always names the matchmaker, never generic language.
 */
export function formatIntroNotification(matchmakerFirstName: string) {
  return {
    title: matchmakerFirstName,
    body: `${matchmakerFirstName} thinks you two should meet`,
  };
}
```

- [ ] **Step 2: Register a foreground notification handler in `app/_layout.tsx`**

Without this, a notification fired while the app is in the foreground (which
is always true for this flow — the user just tapped Send inside the app)
won't display a banner at all on current Expo SDKs.

Add the import near the top, with the other `expo-*` imports:

```ts
import * as Notifications from "expo-notifications";
```

Add this call at module scope, directly below the existing
`SplashScreen.preventAutoHideAsync();` line:

```ts
// Without an explicit handler, notifications fired while the app is
// foregrounded (always true for the Matchmaker send flow) don't show a
// banner on current Expo SDKs.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/notifications.ts app/_layout.tsx
git commit -m "feat: add intro-notification copy and foreground notification handler"
```

---

### Task 2: Sent-intros store

**Files:**
- Create: `store/intros.ts`

**Interfaces:**
- Consumes: `SentIntro` type from `components/intros/mockSentIntros.ts` (fields: `id, personAName, personAAvatarUri?, personBName, personBAvatarUri?, sentAt, status: "pending"|"matched", note`), `MOCK_SENT_INTROS` (same file), `MatchmakerFriend` type from `components/matchmaker/mockMatchmakerFriends.ts` (fields: `id, name, imageUri?, canIntroduce, activePendingCount, lookingToGetSetUp`).
- Produces: `useIntrosStore` — a Zustand hook with state shape `{ sentIntros: SentIntro[]; sendIntro: (friendA: MatchmakerFriend, friendB: MatchmakerFriend, note: string) => void }`. Consumed by Task 6 (`note.tsx`) and Task 7 (`intros.tsx`, `profile.tsx`).

- [ ] **Step 1: Create `store/intros.ts`**

```ts
import { create } from "zustand";
import { MOCK_SENT_INTROS, type SentIntro } from "../components/intros/mockSentIntros";
import type { MatchmakerFriend } from "../components/matchmaker/mockMatchmakerFriends";

interface IntrosState {
  sentIntros: SentIntro[];
  sendIntro: (friendA: MatchmakerFriend, friendB: MatchmakerFriend, note: string) => void;
}

export const useIntrosStore = create<IntrosState>()((set) => ({
  sentIntros: MOCK_SENT_INTROS,

  sendIntro: (friendA, friendB, note) => {
    const newIntro: SentIntro = {
      id: String(Date.now()),
      personAName: friendA.name,
      personAAvatarUri: friendA.imageUri,
      personBName: friendB.name,
      personBAvatarUri: friendB.imageUri,
      sentAt: new Date().toISOString(),
      status: "pending",
      note,
    };
    set((state) => ({ sentIntros: [newIntro, ...state.sentIntros] }));
  },
}));
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add store/intros.ts
git commit -m "feat: add sent-intros store for the Matchmaker send flow"
```

---

### Task 3: `SelectedPairHeader` component

**Files:**
- Create: `components/matchmaker/SelectedPairHeader.tsx`

**Interfaces:**
- Consumes: `MatchmakerFriend` type from `./mockMatchmakerFriends`, `Avatar` from `../ui/Avatar` (props: `name, size?, index?, imageUri?`).
- Produces: `SelectedPairHeader` component, props `{ friendA: MatchmakerFriend; friendB: MatchmakerFriend }`. Consumed by Task 6.

- [ ] **Step 1: Create `components/matchmaker/SelectedPairHeader.tsx`**

```tsx
import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Avatar } from "../ui/Avatar";
import { coral, ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";
import type { MatchmakerFriend } from "./mockMatchmakerFriends";

interface SelectedPairHeaderProps {
  friendA: MatchmakerFriend;
  friendB: MatchmakerFriend;
}

function ConnectorIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={coral[500]} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

function PersonColumn({ friend, index }: { friend: MatchmakerFriend; index: number }) {
  return (
    <View style={{ alignItems: "center", gap: spacing[2] }}>
      <Avatar name={friend.name} size={72} index={index} imageUri={friend.imageUri} />
      <Text style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.base[0], color: ink[900] }}>
        {friend.name.split(" ")[0]}
      </Text>
    </View>
  );
}

/**
 * Compact "who's meeting" header for the Matchmaker note screen — avatars +
 * first names only, since MatchmakerFriend carries no age/tagline the way
 * TwoPersonHeader's PersonHeaderInfo does.
 */
export function SelectedPairHeader({ friendA, friendB }: SelectedPairHeaderProps) {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing[6] }}
    >
      <PersonColumn friend={friendA} index={0} />
      <ConnectorIcon />
      <PersonColumn friend={friendB} index={1} />
    </View>
  );
}

export default SelectedPairHeader;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/matchmaker/SelectedPairHeader.tsx
git commit -m "feat: add SelectedPairHeader for the Matchmaker note screen"
```

---

### Task 4: `NoteComposerCard` component

**Files:**
- Create: `components/matchmaker/NoteComposerCard.tsx`

**Interfaces:**
- Consumes: `gradients.sunset` from `../../constants/colors`, `elevation.sm` from `../../constants/elevation`.
- Produces: `NoteComposerCard` component, props `{ value: string; onChangeText: (text: string) => void }`. Consumed by Task 6.

- [ ] **Step 1: Create `components/matchmaker/NoteComposerCard.tsx`**

```tsx
import { Text, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { gradients } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { elevation } from "../../constants/elevation";

interface NoteComposerCardProps {
  value: string;
  onChangeText: (text: string) => void;
}

/**
 * Editable twin of IntroNoteCard — same sunset-gradient treatment, but the
 * body is a live TextInput so what the matchmaker types is exactly what
 * recipients will see. Kept separate from IntroNoteCard (read-only display)
 * since the two own different concerns.
 */
export function NoteComposerCard({ value, onChangeText }: NoteComposerCardProps) {
  return (
    <View style={[elevation.sm, { flex: 1 }]}>
      <LinearGradient
        colors={gradients.sunset}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flex: 1,
          borderRadius: radii.xl,
          padding: spacing[8],
          overflow: "hidden",
        }}
      >
        <Text
          style={{
            fontFamily: fonts.monoMedium,
            fontSize: fontSize.xs[0],
            letterSpacing: 1,
            textTransform: "uppercase",
            color: "#FFFFFF",
          }}
        >
          YOUR INTRO NOTE
        </Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Write something that sounds like you…"
          placeholderTextColor="rgba(255,255,255,0.6)"
          multiline
          autoFocus
          cursorColor="#FFFFFF"
          style={{
            marginTop: spacing[4],
            flex: 1,
            fontFamily: fonts.display,
            fontSize: fontSize["2xl"][0],
            lineHeight: fontSize["2xl"][1],
            color: "#FFFFFF",
            textAlignVertical: "top",
          }}
        />
      </LinearGradient>
    </View>
  );
}

export default NoteComposerCard;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/matchmaker/NoteComposerCard.tsx
git commit -m "feat: add NoteComposerCard for the Matchmaker note screen"
```

---

### Task 5: `SendConfirmationOverlay` component

**Files:**
- Create: `components/matchmaker/SendConfirmationOverlay.tsx`

**Interfaces:**
- Produces: `SendConfirmationOverlay` component, props `{ visible: boolean; onDismiss: () => void }`. Calls `onDismiss` once, 1.5s after `visible` becomes `true`. Consumed by Task 6.

- [ ] **Step 1: Create `components/matchmaker/SendConfirmationOverlay.tsx`**

```tsx
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { ink, mint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { elevation } from "../../constants/elevation";

interface SendConfirmationOverlayProps {
  visible: boolean;
  onDismiss: () => void;
}

function CheckIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 13l4 4L19 7"
        stroke="#FFFFFF"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * "Your intro is on its way" confirmation — the Matchmaker-send
 * micro-interaction specified in CLAUDE.md. Auto-dismisses via onDismiss
 * 1.5s after becoming visible.
 */
export function SendConfirmationOverlay({ visible, onDismiss }: SendConfirmationOverlayProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, 1500);
    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(180)}
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(26,20,18,0.35)",
      }}
    >
      <View
        style={[
          elevation.md,
          {
            alignItems: "center",
            gap: spacing[4],
            backgroundColor: surface.paper,
            borderRadius: radii.xl,
            paddingVertical: spacing[8],
            paddingHorizontal: spacing[10],
          },
        ]}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radii.pill,
            backgroundColor: mint[500],
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckIcon />
        </View>
        <Text
          style={{
            fontFamily: fonts.bodyMedium,
            fontSize: fontSize.base[0],
            color: ink[900],
            textAlign: "center",
          }}
        >
          Your intro is on its way
        </Text>
      </View>
    </Animated.View>
  );
}

export default SendConfirmationOverlay;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/matchmaker/SendConfirmationOverlay.tsx
git commit -m "feat: add SendConfirmationOverlay for the Matchmaker send flow"
```

---

### Task 6: `app/matchmaker/note.tsx` screen

**Files:**
- Create: `app/matchmaker/note.tsx`

**Interfaces:**
- Consumes: `SelectedPairHeader` (Task 3), `NoteComposerCard` (Task 4), `SendConfirmationOverlay` (Task 5), `useIntrosStore` (Task 2), `formatIntroNotification` (Task 1), `MOCK_MATCHMAKER_FRIENDS` from `../../components/matchmaker/mockMatchmakerFriends`, `MOCK_PROFILE_USER` from `../../components/profile/mockProfile`, `Button` from `../../components/ui/Button`.
- No exports consumed elsewhere — this is a route, not a library module.

- [ ] **Step 1: Create `app/matchmaker/note.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Button } from "../../components/ui/Button";
import { SelectedPairHeader } from "../../components/matchmaker/SelectedPairHeader";
import { NoteComposerCard } from "../../components/matchmaker/NoteComposerCard";
import { SendConfirmationOverlay } from "../../components/matchmaker/SendConfirmationOverlay";
import { MOCK_MATCHMAKER_FRIENDS } from "../../components/matchmaker/mockMatchmakerFriends";
import { MOCK_PROFILE_USER } from "../../components/profile/mockProfile";
import { useIntrosStore } from "../../store/intros";
import { formatIntroNotification } from "../../lib/notifications";
import { ink, surface } from "../../constants/colors";
import { textStyles } from "../../constants/typography";
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

  const friendA = MOCK_MATCHMAKER_FRIENDS.find((f) => f.id === friendAId);
  const friendB = MOCK_MATCHMAKER_FRIENDS.find((f) => f.id === friendBId);

  // Malformed/direct deep link with no matching friends — not reachable via
  // the app's own navigation (select.tsx only ever passes eligible ids), so
  // this just backs out rather than showing a dedicated error state.
  useEffect(() => {
    if (!friendA || !friendB) {
      router.back();
    }
  }, [friendA, friendB]);

  if (!friendA || !friendB) {
    return null;
  }

  const canSend = note.trim().length > 0;

  async function handleSend() {
    if (!friendA || !friendB || !canSend) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    useIntrosStore.getState().sendIntro(friendA, friendB, note.trim());

    const { status } = await Notifications.getPermissionsAsync();
    let granted = status === "granted";
    if (!granted && status !== "denied") {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.status === "granted";
    }
    if (granted) {
      const matchmakerFirstName = MOCK_PROFILE_USER.name.split(" ")[0];
      await Notifications.scheduleNotificationAsync({
        content: formatIntroNotification(matchmakerFirstName),
        trigger: null,
      });
    }

    setConfirming(true);
  }

  function handleConfirmationDismiss() {
    setConfirming(false);
    router.dismissTo("/(tabs)" as never);
  }

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

      <View style={{ flex: 1, paddingHorizontal: spacing[6], paddingTop: spacing[6] }}>
        <NoteComposerCard value={note} onChangeText={setNote} />
      </View>

      <View
        style={{
          paddingHorizontal: spacing[6],
          paddingTop: spacing[4],
          paddingBottom: insets.bottom + spacing[4],
          borderTopWidth: 1,
          borderTopColor: ink[200],
        }}
      >
        <Button title="Send intro" onPress={handleSend} disabled={!canSend} />
      </View>

      <SendConfirmationOverlay visible={confirming} onDismiss={handleConfirmationDismiss} />
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run: `npx expo start --web` (or `--ios`/`--android` if a simulator/device is available)

1. From Home, tap the coral FAB → Step 1 opens.
2. Pick two eligible friends → Continue → Step 2 (`note.tsx`) opens, showing both friends' avatars/first names via `SelectedPairHeader`.
3. Send button is disabled with an empty note.
4. Type a note into the gradient card — text appears in white Bricolage type, placeholder disappears.
5. Tap "Send intro" — confirmation card ("Your intro is on its way") appears, and (if notification permission is granted when prompted) a system notification banner appears with the matchmaker's first name and "thinks you two should meet".
6. After ~1.5s, the confirmation dismisses and the screen returns to the Home tab.
7. Tap X on Step 2 instead of sending — returns to Step 1 with the same two friends still selected.

- [ ] **Step 4: Commit**

```bash
git add app/matchmaker/note.tsx
git commit -m "feat: build Matchmaker Step 2 note-and-send screen"
```

---

### Task 7: Wire Intros tab + Profile screen to the store

**Files:**
- Modify: `app/(tabs)/intros.tsx`
- Modify: `app/(tabs)/profile.tsx`

**Interfaces:**
- Consumes: `useIntrosStore` (Task 2).

- [ ] **Step 1: Update `app/(tabs)/intros.tsx` to read from the store**

Replace this import:

```tsx
import { MOCK_SENT_INTROS, type SentIntro } from "../../components/intros/mockSentIntros";
```

with:

```tsx
import type { SentIntro } from "../../components/intros/mockSentIntros";
import { useIntrosStore } from "../../store/intros";
```

Replace this line:

```tsx
  const hasSentIntros = MOCK_SENT_INTROS.length > 0;
```

with:

```tsx
  const sentIntros = useIntrosStore((s) => s.sentIntros);
  const hasSentIntros = sentIntros.length > 0;
```

Replace the three remaining `MOCK_SENT_INTROS` usages further down:

```tsx
        <SentIntroStats intros={MOCK_SENT_INTROS} />

        <SentIntroList
          intros={MOCK_SENT_INTROS}
```

with:

```tsx
        <SentIntroStats intros={sentIntros} />

        <SentIntroList
          intros={sentIntros}
```

- [ ] **Step 2: Update `app/(tabs)/profile.tsx` to read from the store**

Replace this import:

```tsx
import { MOCK_SENT_INTROS } from "../../components/intros/mockSentIntros";
```

with:

```tsx
import { useIntrosStore } from "../../store/intros";
```

Replace this line:

```tsx
  const pendingIntro = MOCK_SENT_INTROS.find((intro) => intro.status === "pending");
```

with:

```tsx
  const sentIntros = useIntrosStore((s) => s.sentIntros);
  const pendingIntro = sentIntros.find((intro) => intro.status === "pending");
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `npx expo start --web`

1. Go through the full Matchmaker flow (Step 1 → Step 2 → Send) from Task 6's verification.
2. After the confirmation dismisses and you land on Home, switch to the Intros tab — the new intro appears at the top of the sent list with status "Pending" and the note you wrote.
3. Switch to the Profile tab — the pending-intro-dependent UI (`MatchmakerPanel`) reflects the freshly sent intro instead of only the original fixture data.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/intros.tsx" "app/(tabs)/profile.tsx"
git commit -m "feat: read sent intros from the shared store on Intros tab and Profile"
```
