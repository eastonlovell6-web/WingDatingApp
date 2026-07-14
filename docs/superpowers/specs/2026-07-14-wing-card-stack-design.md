# On Wing Card Stack (Wingman Home) — Design

## Problem

The wingman-only Home screen (`role === "wing-somebody"`) shows
`HomeHeader` → `PromptCard` → `FriendsRow`. `FriendsRow` renders each "On
Wing" friend as a 56px avatar with initials (none of `MOCK_FRIENDS` currently
has `imageUri` set) and a first name underneath. For a screen whose whole
purpose is helping a wingman recognize and set up their friends, small
initials circles don't do the job — you can't recognize a face you can't
see, and the row format doesn't invite browsing.

This adds a swipeable, full-bleed photo card view of the same friend list,
used only on the wingman branch of Home. The wing-me branch keeps
`FriendsRow` exactly as it is today.

## Component: `components/home/WingCardStack.tsx`

A new component, not a modification of `FriendsRow` — the two are
visually and behaviorally distinct enough (small horizontal icon row vs.
full-bleed swipeable photo cards, different animation/measurement code)
that branching one component with a variant prop would blur its purpose.
`FriendsRow.tsx` is untouched.

```ts
interface WingCardStackProps {
  friends: WingFriend[];
}
```

Same `WingFriend` type and same `MOCK_FRIENDS` data as `FriendsRow` uses
today — no filtering by matchmaker eligibility. Data source unchanged, only
presentation differs.

### Layout

- Section keeps the existing "ON WING" DM Mono, coral-500, uppercase
  eyebrow label above the cards (unchanged from `FriendsRow` today).
- One card fills the section's width at a time (the width available inside
  the Home `ScrollView`'s `paddingHorizontal: spacing[6]` content area).
- Card: `radii.xl` (28px) corners, `elevation.sm`/`md` warm shadow, photo
  (`Image`, `resizeMode: "cover"`) fills the card edge-to-edge, a bottom
  `LinearGradient` scrim (`transparent` → `rgba(0,0,0,0.55)`, same
  convention already used elsewhere for text-over-photo legibility) sits
  behind the name.
- Name: friend's first name, `fonts.display` (Bricolage Grotesque),
  white, positioned bottom-left over the scrim — same visual language as
  `IntroNoteCard`.
- Card size: `aspectRatio: 4/5` at the section's full available width
  (portrait-leaning photo ratio) — matches the existing
  `ReadOnlyPhotoCarousel` convention in
  `components/friend/FriendPhotoPromptPanel.tsx` rather than a fixed
  pixel height, so it scales correctly across phone widths.
- No next-card peek. During planning this was reconsidered in favor of
  reusing `FriendPhotoPromptPanel`'s existing full-width-paging-plus-dots
  carousel pattern verbatim (`ReadOnlyPhotoCarousel` + `CarouselDots`) —
  that component already solves "signal there's more to swipe" via the
  dot row, and matching it exactly keeps this app's second photo-carousel
  implementation consistent with its first instead of introducing a new
  one-off peek affordance.

### Swipe mechanic

Horizontal `ScrollView` with snap-to-card paging:

- Measures its own available width via `onLayout` (same pattern
  `FriendPickerGrid` already uses for its own width-dependent layout).
- `snapToInterval={cardWidth + gap}`, `decelerationRate="fast"`,
  `showsHorizontalScrollIndicator={false}`.
- No pan-gesture/rotation physics (that would only make sense if a swipe
  meant a real accept/reject decision, and it doesn't here — tapping a
  card still opens the profile, same low-stakes browsing as today's row).

### Position indicator

Small row of pill dots below the card, one per friend:

- Active dot: coral-500, slightly wider.
- Inactive dots: ink-200/300.
- Updates on `onMomentumScrollEnd` by computing the nearest snapped index
  from `contentOffset.x`.

### Interaction

- Card tap: `Haptics.impactAsync(Light)` then
  `router.push(`/friend/${friend.id}`)` — identical destination and
  haptic to today's `FriendAvatarButton` in `FriendsRow`.
- Card press micro-interaction: scale 0.98, matching the existing card
  press convention used elsewhere in the app.
- `accessibilityRole="button"`, `accessibilityLabel={friend.name}` per
  card, matching `FriendsRow`'s existing accessibility treatment.

### Entrance animation

Same `FadeInDown.duration(250).delay(ENTRANCE_DELAY)` convention
`FriendsRow` uses today (280ms delay, after the card-stagger sequence
above it).

## Data: `components/home/friendsMock.ts`

None of the seven `MOCK_FRIENDS` entries currently sets `imageUri`, so
today's row already falls back to initials for everyone — the "small
icon" the user is trying to move away from. Populate `imageUri` for each
entry using the first photo from the matching id in
`components/friend/mockFriendProfiles.ts` (`MOCK_FRIEND_PROFILES[id].photos[0]`),
since ids are already shared 1:1 across `friendsMock.ts`,
`mockMatchmakerFriends.ts`, and `mockFriendProfiles.ts` per existing code
comments. No new data source, no meta/bio fields pulled in — just the one
photo URL per friend, hand-copied into the fixture (not computed at
runtime, keeping `WingFriend` a plain literal array as it is today).

## Home Screen (`app/(tabs)/index.tsx`)

```tsx
{isWingman ? (
  <PromptCard prompt={getTodaysPrompt()} introducibleCount={getIntroducibleFriends().length} />
) : (
  <IntroFeed intros={MOCK_INTROS} />
)}
{isWingman ? (
  <WingCardStack friends={MOCK_FRIENDS} />
) : (
  <FriendsRow friends={MOCK_FRIENDS} />
)}
```

- `isWingman === true`: `WingCardStack` renders in place of `FriendsRow`.
- `isWingman === false` (including null/undefined `role`): `FriendsRow`
  renders exactly as today — no change to that path.
- `HomeHeader` and the FAB are unaffected in both branches.

## Edge Cases

- Friend with no photo (hypothetically, if a future real friend has no
  `imageUri`): card falls back to the same initials treatment `Avatar`
  already provides elsewhere — no separate empty-photo state needed since
  `Avatar` isn't reused here directly, but the card's `Image` component
  should mirror that fallback (initials tile) rather than showing a
  broken image.
- Single friend in the list: `ScrollView` still renders correctly with one
  card, no dots needed (or a single, non-interactive dot) — no swipe
  affordance shown if there's nothing to swipe to.
- Zero friends: out of scope — `MOCK_FRIENDS` is a fixed non-empty fixture
  today; no empty state existed for `FriendsRow` either.

## Out of Scope

- Filtering to only `canIntroduce`/eligible friends — same full list as
  today's row.
- Meta line (age/school) or eligibility badges on the card — name only,
  matching today's row's information density.
- Tinder-style drag-to-dismiss physics — no accept/reject semantic exists
  for this list.
- Multi-photo swiping within a single friend's card — one photo per
  friend, swiping moves between friends, not between a friend's photos.
- Changes to `FriendsRow.tsx` or the wing-me home screen path.
- Wiring `friendsMock.ts` to Supabase — still a throwaway fixture.

## Testing

- Typecheck passes.
- Manual verification via the running Expo dev server:
  - A `role: "wing-somebody"` profile's Home screen shows `WingCardStack`
    (full-bleed photo cards) instead of `FriendsRow` below `PromptCard`.
  - A `role: "wing-me"` (or null) profile's Home screen is visually
    unchanged — still the small-avatar `FriendsRow`.
  - Swiping through the card stack pages one friend at a time with a
    visible next-card peek and dot indicator updating.
  - Tapping a card navigates to `/friend/[friendId]` for that friend,
    identical destination to tapping today's avatar.
  - Each friend's real photo (from `mockFriendProfiles.ts`) displays,
    not initials.
