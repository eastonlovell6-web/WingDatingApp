# Chats Screen: Unread Badges + Swipe Actions

## Summary

Add two things to each row on the Chats tab: an unread-count badge (replacing
the current plain dot) and swipe-left-to-reveal row actions (Mute / Archive /
Delete). No other part of the Chats screen changes.

## 1. Unread count badge

**Data model** — `ChatPreview.unread: boolean` becomes `ChatPreview.unreadCount: number`
in `components/chats/mockChats.ts` (`0` = read, matches today's `false` case).

**Visual** — In `components/chats/ChatRow.tsx`, replace the 8×8 coral dot with
a pill: `coral[500]` background, white `fonts.bodyBold` text, `radii.pill`,
~6px horizontal padding, min-width so single digits render as a circle not an
oval. Hidden entirely when `unreadCount === 0` (no empty pill, no dot). Counts
above 9 display as "9+".

**Weight bump** — When `unreadCount > 0`:
- Timestamp text: `fonts.body` → `fonts.bodyMedium`
- Preview (`TruncatedText`) text: `fonts.body` → `fonts.bodyMedium`

(The sender name already swaps `fonts.bodyMedium` ↔ `fonts.bodyBold` on
unread today — unchanged, just now joined by the other two lines.)

## 2. Swipe-to-reveal row actions

**Library choice** — Use `Swipeable` from `react-native-gesture-handler`
(already a project dependency; `GestureHandlerRootView` is already mounted at
the app root in `app/_layout.tsx`) instead of a hand-rolled `Gesture.Pan`.
`Swipeable` already provides 1:1 drag tracking, threshold-based snap, clamped
overshoot, and an imperative `.close()` — exactly what the spec asks for,
without reimplementing gesture physics.

**Structure** — `ChatRow`'s existing card becomes the `children` of a
`Swipeable`. `renderRightActions` returns three fixed 70px-wide buttons,
left-to-right: Mute, Archive, Delete. Each is icon + white `fonts.bodyMedium`
label on a solid fill:
- Mute: `butter[700]` (#C9991F, nearest existing token to "amber")
- Archive: `ink[700]` (#4A3F3C, nearest existing token to "slate grey")
- Delete: `coral[600]` (existing accent, matches spec's "coral/red" note)

New minimal line-art SVG icons (bell-slash, archive box, trash) added
alongside `components/ui/TabGlyphs.tsx`'s existing icon style.

**Drag/snap config**:
- `friction={1}` — 1:1 pointer tracking
- `overshootRight={false}` — hard-clamps at the actions' total width (210px)
- `rightThreshold` = half of the actions width — snap open past halfway,
  snap closed otherwise (this is `Swipeable`'s default behavior, made
  explicit)
- `animationOptions` tuned (spring `speed`/`bounciness: 0`) to settle in the
  ~250–300ms ease-out range the spec asks for, rather than switching to a
  literal timing curve

**Single-row-open coordination** — `ChatList` holds a ref to whichever
`Swipeable` is currently open. `onSwipeableWillOpen` on a row closes the
previously-open ref before recording the new one. Tapping a row's content
while it's open closes it (via the ref) instead of navigating; tapping a
closed row navigates as it does today.

**Mute** — Calls `.close()` on that row. No data or state change — the spec
only asks for the row to close, and nothing elsewhere in the app has a
"muted" concept to persist to, so none is added.

**Archive / Delete** — Removes the chat from a newly-stateful list. Today
`ChatsScreen` passes the static `MOCK_CHATS` import straight to `ChatList`;
it needs to hold `chats` in local `useState` so removal is reflected. On
press: play the row's exit animation (Reanimated `exiting` fade) while the
list's `LinearTransition` closes the gap on the remaining rows — combined,
this reads as the requested "fade + height shrink," reusing the entrance
pattern already established in `ChatRow.tsx` rather than inventing a new
animation primitive.

## Out of scope (explicitly not touched)

Header, footer copy, FAB, bottom nav, and every other Chats-screen element
stay exactly as they are. No backend/Supabase wiring — mute/archive/delete
only affect local mock state, same fidelity as the rest of the screen today.
