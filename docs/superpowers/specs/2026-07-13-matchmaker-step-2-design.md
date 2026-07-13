# Matchmaker Step 2 — Write Note + Send

## Context

Flow 1 (Matchmaker) step 1 is built: `app/matchmaker/select.tsx` lets the
current user pick two eligible friends and, on Continue, does
`router.push('/matchmaker/note?friendAId=...&friendBId=...')`. That route
doesn't exist yet. This spec covers building it: writing the intro note,
sending it, and the visible effects of sending (Intros tab update + a
simulated push notification).

Out of scope: real backend wiring. Introductions are not written to
Supabase yet, friends are still `MOCK_MATCHMAKER_FRIENDS` fixture data, and
there is no second real device/account to push to. This screen produces
local, in-memory effects only, same as the rest of the app today.

## Navigation

- New file `app/matchmaker/note.tsx`. Reads `friendAId` / `friendBId` via
  `useLocalSearchParams` and looks both up in `MOCK_MATCHMAKER_FRIENDS`.
- No new `Stack.Screen` entry in `app/_layout.tsx`. `matchmaker/select` is
  already registered there with `presentation: "modal"`; pushing to
  `matchmaker/note` from inside that screen advances within the same
  presented sheet (horizontal slide, same cream rounded-top card) rather
  than opening a second modal. This mirrors "STEP 1 OF 2" → "STEP 2 OF 2".
- X (close) button: `router.back()` — returns to Step 1 with selections
  intact. Same behavior as Step 1's X, no special-casing.
- After the send confirmation animation finishes: `router.dismissTo("/(tabs)")`
  — closes the whole modal stack and lands on Home (fire-and-forget: the
  matchmaker flow started from the Home FAB, so returning home closes the loop).

## Layout

Mirrors `select.tsx`'s shell (drag handle, X top-left, eyebrow top-right,
`surface.cream` bg, `radii["2xl"]` top corners, bottom action bar with
divider):

- Eyebrow: "STEP 2 OF 2"
- Headline (Bricolage): "Write the intro"
- Caption: short one-liner, e.g. "A short note goes a long way."
- `SelectedPairHeader` (new component, see below)
- `NoteComposerCard` (new component, see below) — fills remaining space
- Bottom fixed bar: `Button` "Send intro", disabled until the trimmed note
  is non-empty

### `components/matchmaker/SelectedPairHeader.tsx`

Compact "who's meeting" header — not `TwoPersonHeader` (that component
expects `age`/`tagline`, which `MatchmakerFriend` doesn't have; it's built
for the Intro Detail screen's recipient-facing view, a different concern).

- Props: `friendA: MatchmakerFriend`, `friendB: MatchmakerFriend`
- Two `Avatar`s side by side with a small connecting glyph between them,
  first names underneath each

### `components/matchmaker/NoteComposerCard.tsx`

Visually identical to `IntroNoteCard` (sunset gradient, `radii.xl`,
`spacing[8]`, Bricolage body, white text) but editable — kept as a
separate component rather than adding an edit mode to `IntroNoteCard`,
since the two have different concerns (one is read-only display, this one
owns text-input state/behavior).

- Props: `value: string`, `onChangeText: (text: string) => void`
- Body is a multiline, auto-growing `TextInput` (transparent background,
  white text + cursor, no border) instead of `Text`
- Placeholder: "Write something that sounds like you…" in translucent white
- Eyebrow: static label (e.g. "YOUR INTRO NOTE"), not "Intro from X" —
  the matchmaker is writing about themselves, that framing doesn't apply
- No max character cap (matches `IntroNoteCard`, which never truncates);
  Send is disabled only when the trimmed note is empty

## Sent-intro store

New `store/intros.ts` (Zustand), seeded from the existing
`MOCK_SENT_INTROS` fixture:

```ts
interface IntrosState {
  sentIntros: SentIntro[];
  sendIntro: (friendA: MatchmakerFriend, friendB: MatchmakerFriend, note: string) => void;
}
```

- `sendIntro` unshifts a new `SentIntro` onto `sentIntros`: `status: "pending"`,
  `sentAt` = today (ISO), names/avatars taken from the two `MatchmakerFriend`
  objects, `note` = the trimmed text, `id` = `String(Date.now())`.
- `SentIntroList` and `SentIntroStats` are already presentational (they take
  `intros: SentIntro[]` as a prop, no direct import). The actual call sites
  to update are `app/(tabs)/intros.tsx` and `app/(tabs)/profile.tsx`, which
  currently import `MOCK_SENT_INTROS` directly — both switch to reading
  `useIntrosStore((s) => s.sentIntros)` instead, so the Intros tab and the
  Profile screen's pending-intro banner reflect a new send immediately
  without a screen reload.
- `MatchmakerLeaderboardCard` is unaffected — it renders a separate
  `LeaderboardEntry[]` (`mockLeaderboard.ts`), not `SentIntro[]`, and isn't
  part of this change.
- Matchmaker stats (`MOCK_MATCHMAKER_STATS` on the Profile screen) are not
  touched by this change — out of scope, separate screen/concern.

## Send behavior

On tapping "Send intro":

1. Guard: if the trimmed note is empty, no-op (button is already disabled,
   this is just a safety check).
2. Light haptic (`Haptics.impactAsync(Light)`), matching the rest of the app.
3. Call `useIntrosStore.getState().sendIntro(friendA, friendB, note)`.
4. Fire a simulated local push notification (see below).
5. Show a confirmation overlay: "Your intro is on its way" + checkmark,
   per the CLAUDE.md micro-interaction spec — auto-dismiss after 1.5s.
6. After dismiss: `router.dismissTo("/(tabs)")`.

### Simulated push notification

`expo-notifications` is an existing dependency, currently unused anywhere
in the app. This is its first use.

- Add to `lib/notifications.ts`, alongside the existing
  `formatMessageNotification`:

  ```ts
  export function formatIntroNotification(matchmakerFirstName: string) {
    return {
      title: matchmakerFirstName,
      body: `${matchmakerFirstName} thinks you two should meet`,
    };
  }
  ```

  (Exact copy from the Flow 1 spec in CLAUDE.md.)

- In the send handler: request notification permissions if not already
  granted (`Notifications.requestPermissionsAsync()`), then fire one
  immediate local notification (`Notifications.scheduleNotificationAsync`
  with `trigger: null`) using `formatIntroNotification(firstNameOf(MOCK_PROFILE_USER.name))`.
- `app/_layout.tsx` also needs a one-time `Notifications.setNotificationHandler(...)`
  call (shouldShowBanner/shouldShowList) — without it, a notification fired
  while the app is foregrounded (always true here, since the user just
  tapped Send inside the app) won't display a banner at all on current Expo
  SDKs.
- This stands in for what each recipient's device would show — there's
  only one real device in this demo, so one local notification simulates
  the recipient experience rather than two real pushes to two real accounts.
- If permission is denied, skip firing silently and continue the rest of
  the send flow (steps 3, 5, 6 still happen) — this is a demo aid, not a
  blocking requirement.

## Testing

- Unit/manual: selecting two friends in Step 1 → Continue → note screen
  shows correct names/avatars.
- Send with empty note: button stays disabled.
- Send with a note: confirmation shows, Intros tab shows the new pending
  entry at the top, a local notification appears (if permission granted),
  screen returns to Home after ~1.5s.
- X on Step 2 returns to Step 1 with the same two friends still selected.
