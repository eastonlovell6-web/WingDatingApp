# Wing App — Claude Code Instructions

## What Wing Is

Wing is a mutual-friend-gated dating app. You cannot match with anyone unless a mutual friend actively introduces you. No swiping on strangers. No cold matches. Every introduction has a human behind it.

**Core insight:** The best relationships still start through mutual friends. Wing makes social context the entire product — not optional metadata like Hinge.

---

## Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — prefer editing existing files
- NEVER add features, states, or flows not listed in this file
- ALWAYS read a file before editing it
- Keep files under 500 lines — split when approaching the limit
- NEVER commit secrets, credentials, or .env files
- ALWAYS run tests after code changes
- Validate input at system boundaries only — trust internal code

## Build Philosophy — One Screen at a Time

**NEVER build multiple screens in a single session unless explicitly told to.**

Each screen is built, reviewed, and approved before moving to the next. This is not optional — it is the core build strategy. Building everything at once produces a mediocre version of every screen. Building one screen to a high standard creates a reference that raises the bar for everything that follows.

**Screen order:**
1. Onboarding (phone auth → name → photos → friend visibility → you're in)
2. Home feed (incoming intros + friends row)
3. Intro Card (full-screen pending intro)
4. Matchmaker Step 1 (select two friends)
5. Matchmaker Step 2 (write note + send)
6. Request an Intro
7. Chat
8. Profile
9. Friend Visibility Settings

**After completing each screen:**
- Stop and wait for feedback before proceeding
- Ask: "Does this screen pass the design critique checklist?" (see bottom of this file)
- Only move to the next screen after explicit approval

---

## The Two Core Flows

**Every feature must serve one of these two flows. Build nothing outside them.**

### Flow 1 — Matchmaker (friend-initiated intro)
1. Friend opens app, sees their contacts on Wing
2. Friend selects two people, writes a short intro note
3. Both recipients get a push notification: "[Maya] thinks you two should meet"
4. Each sees: matchmaker profile + intro note + the other person's profile
5. Both accept independently, chat unlocks
6. If either passes, nothing happens, no one is notified

### Flow 2 — Request (user-initiated intro)
1. User browses friends-of-friends only (not global)
2. User taps "Request an intro" on a profile, selects the mutual friend
3. Mutual friend gets a notification: "[Name] wants you to introduce them"
4. Mutual friend approves or declines; if approved, both go through Flow 1
5. If declined, requester gets a neutral "intro not available" message. No reason given.

---

## Non-Negotiable Product Requirements

These came from N=10 user research interviews. They are not optional.

**1. Silent rejection** — Passing on an intro NEVER notifies the matchmaker or the other person. The pass is invisible. No confirmation, no "they passed," nothing.

**2. Matchmaker firewall** — After an intro is sent, the matchmaker has ZERO visibility into what happens. No chat content, no read status, no "they matched." The only notification they ever receive is "your intro was accepted by both" — and only if both accept.

**3. Fire-and-forget mechanic** — The matchmaker flow must be completeable in under 60 seconds. Write a note, send, done. No follow-up required.

**4. Anti-spam limits** — A single user can have a maximum of 3 active pending intros at a time. Enforce server-side.

**5. No read receipts** — Anywhere in the app. Not in chats. Not on intro notifications. Not in any premium tier.

---

## Design System

**Source:** Claude Design official mockup (June 2026). These tokens are final.

### Design Language
- Background: warm cream #FBF8F5 — NOT pure white. The whole app has warmth.
- Primary action: coral #FF6150 — all CTAs, active nav, FAB center button
- Secondary brand: plum #573166 — trust, mutual friend moments, dark lockup
- Three fonts with distinct roles — never mix them up
- Gradients on hero moments only: avatar fills, intro note cards, app icon
- Shadows: warm-tinted, never harsh pure black

### Voice & Tone — "Warm, candid, a little cheeky"
- ALWAYS name the friend: "Maya thinks you two would click" NOT "A friend wants to introduce you"
- Always second person, active, kind
- Never algorithmic language, never jargon
- NOT THIS: "New match found in your area!" / "Submit candidate referral."

### Colors

```
--- Backgrounds ---
App bg:        #FBF8F5   (warm cream — NOT pure white)
Card surface:  #FFFFFF   (white cards sit on cream bg)

--- Text ---
Primary text:  ink-900   (warm near-black ~#1A1412)
Muted text:    ink-500   (warm mid-gray — captions, placeholders)

--- Brand Coral (primary action "the spark") ---
coral-100:     #FFE0D9   (disabled states, blush bg)
coral-300:     #FF9E8C   (hover fills)
coral-500:     #FF6150   (PRIMARY — all CTAs, active nav, logo)
coral-600:     #ED4733   (button hover)
coral-700:     #C5331F   (button pressed)

--- Brand Plum (trust, depth, mutual friend) ---
plum-100:      #EBDCEE   (mutual friend badge bg)
plum-500:      #6E3F80   (strong plum accent)
plum-600:      #573166   (dark lockup bg, deep brand)

--- Status accents ---
Mint:          medium mint green   (MATCHED badge, success states)
Butter:        golden yellow       (PENDING badge, warning)
Blush:         soft pink           (Unmatch button, soft accents)

--- Signature gradients (hero/avatar/intro card only) ---
Sunset:  #FF6150 coral to blush pink
Warm:    butter yellow to #FF6150 coral
Dusk:    #FF6150 coral to #6E3F80 plum
```

### Typography — 3 fonts, one job each

**Bricolage Grotesque — Display/emotional copy**
- Headlines, big moments, intro note card text, onboarding headings
- Weight 700 bold, 600 semibold
- Never use for body text or labels

**DM Sans — Body/UI**
- All reading text, UI copy, button labels, captions
- Weight 600 medium, 400 regular
- Caption: 14px muted. Minimum 14px on mobile.

**DM Mono — Labels/data**
- Eyebrow labels: "INTRO FROM MAYA" (uppercase, coral color)
- Stat numerals: "12 INTROS" (large number + small caps unit)
- Always uppercase for eyebrow use

### Spacing — 4px base unit
```
Step 2:   8px
Step 4:   16px
Step 6:   24px
Step 8:   40px
Step 10:  64px
Step 12:  96px
```
All spacing from this scale only. No magic numbers.

### Corner Radii
```
sm:    10px  (chips, tight elements)
md:    16px  (standard cards, inputs)
lg:    22px  (large cards)
xl:    28px  (action cards, hero elements)
2xl:   36px  (prominent surfaces)
pill:  999px (buttons, badges, avatars)
```

### Elevation
- 6 levels: xs, sm, md, lg, xl, brand
- Shadow tint is warm (slight coral/cream warmth) — never pure rgba(0,0,0,x)

### Navigation
- White pill card floating above cream background
- 4 tabs: For You, Intros, Chats, You
- Center: coral gradient FAB (#FF6150 to blush) with + make-an-intro action
- Active tab: coral #FF6150 icon + label visible
- Inactive: muted gray icon, no label

### Buttons
```
Accept intro:  coral-500 fill, white text
Maybe later:   plum-100 lavender fill, dark text
Skip:          outlined ink-300 border, dark text
Unmatch:       blush fill, coral-600 text
Disabled:      coral-100 fill, muted text
```

### Status Badges
```
NEW INTRO:      coral-500 filled, white DM Mono caps
MATCHED:        mint outline + mint text
PENDING:        butter outline + dark text
MUTUAL FRIEND:  plum-100 filled, plum text
```

### Intro Note Card (most important component in the app)
- Background: Sunset gradient (coral to blush)
- Eyebrow: "INTRO FROM [NAME]" — DM Mono, white, uppercase
- Body: Bricolage Grotesque bold, white, large — the friend's actual note
- Corner radius: xl (28px)
- This is the moment that delivers the aha experience — obsess over this component

### Component States (all required)
- Buttons: default, hover (coral-600), pressed (scale 0.97 + coral-700), disabled (coral-100)
- Inputs: empty, focused (coral-500 border 1.5px), filled, error
- Cards: default, pressed (scale 0.98, 120ms)
- Intro cards: default, accepted (mint bg), passed (removed silently — no state shown)

---

## Key Screens (v1 only)

| Screen | Purpose |
|--------|---------|
| Onboarding | Phone auth, name, photos, friend visibility setup |
| Home | Incoming intros feed + friends row |
| Intro Card | Full-screen pending intro (matchmaker note + match profile) |
| Matchmaker Step 1 | Select two friends to introduce |
| Matchmaker Step 2 | Write note + send |
| Request an Intro | Browse friends-of-friends, select mutual friend |
| Chat | No read receipts |
| Profile | Photos, prompts, matchmaker stats, privacy controls |
| Friend Visibility Settings | Who can introduce you |

---

## Micro-Interactions (Required)

- Intro card entrance: slide up + fade in, 220ms ease-out
- Accept button tap: spring scale 1.0 to 1.06 to 1.0 + success haptic
- Pass button tap: subtle scale press + light haptic — no dramatic animation (silence is the design)
- Matchmaker send: "Your intro is on its way" checkmark, 1.5s auto-dismiss
- Screen transitions: horizontal slide — never instant jumps

---

## Tech Stack

```
Mobile:     Expo (React Native) SDK 52+
Language:   TypeScript — strict mode always on
Styling:    NativeWind + custom design tokens
Animation:  React Native Reanimated 3 + Gesture Handler
Sharing:    react-native-view-shot (view→PNG capture) + expo-sharing (native share sheet) — Matchmaker score share card
Navigation: Expo Router (file-based routing)
Backend:    Supabase (auth + database + realtime + storage)
Push:       Expo Notifications + Supabase Edge Functions
State:      Zustand (global) + React Query (server state)
Fonts:      expo-font with Bricolage Grotesque, DM Sans, DM Mono
```

### Supabase Tables
Checked-in schema lives in `supabase/sql/` (hand-applied via the SQL Editor, no migrations folder — `001_notifications_schema.sql` for introductions/intro_requests/chats/messages/push_tokens, `002_users_friendships_schema.sql` for users/friendships). No `matchmaker_stats` table — counts compute live via `getMatchmakerStats`/`getIntroducersCount` instead; score, percentile, rank tier/level/streak, and badges are now also live-computed (lib/matchmakerScore.ts's pure formulas over those counts plus friend-group rank), and the friend-group leaderboard is real too, via the `matchmaker-leaderboard` Edge Function (`getMatchmakerLeaderboardStats`, lib/introductions.ts) — same admin-client-for-cross-user-read pattern as `discover-people`/`discover-person`.
```
users            — id, phone, name, photos[], bio_prompts[], role ("wing-me" | "wing-somebody", from onboarding intent)
friendships      — user_id, friend_id, can_introduce (bool, default false)
introductions    — id, matchmaker_id, user_a_id, user_b_id, note, status
  status enum:   pending_a | pending_b | both_pending | accepted | passed | withdrawn
                 (withdrawn = matchmaker cancelled their own still-pending sent intro)
intro_requests   — id, requester_id, target_id, mutual_friend_id, status
  status enum:   pending | approved | declined
chats            — id, intro_id
messages         — id, chat_id, sender_id, content, created_at
                   NO read_at field — ever
matchmaker_stats — user_id, intros_sent, intros_accepted (counts only)
push_tokens      — user_id, expo_push_token, updated_at
```

---

## File Structure

```
/app
  /(auth)
    index.tsx          — phone number entry
    verify.tsx         — OTP verification
    intent.tsx         — "What brings you to Wing?" (wing-me | wing-somebody)
    onboarding.tsx     — name, photos, friend visibility setup (headline varies by ?intent=); saves `role` ("wing-me" | "wing-somebody", from ?intent=) to the users table alongside name in the same upsert
  /(tabs)
    index.tsx          — home feed; wing-me/null-role users see the incoming-intros feed (real data via `getIncomingIntroductions`, lib/introductions.ts) + FriendsRow (small avatars); wing-somebody (wingman-only) users see a daily PromptCard in place of the intro feed, and WingCardStack (full-bleed swipeable photo cards) in place of FriendsRow below it
    discover.tsx       — friends-of-friends browse; 2-col grid of `DiscoverPersonCard`s from `getDiscoverPeople()` (lib/discover.ts, real data via the `discover-people` Edge Function); registered as a `Tabs.Screen` with `options={{ href: null }}` so it's routable but not in the tab bar — reached via a search-icon button in `HomeHeader` (`onDiscoverPress` → `router.push("/discover")`), not a tab
    intros.tsx         — matchmaker sent intros history; real data via `getSentIntroductions` (lib/introductions.ts), Nudge/Withdraw call the `nudge-introduction`/`withdraw-introduction` Edge Functions and invalidate the `["sentIntroductions", userId]` React Query cache (shared with profile.tsx's pending-intro lookup)
    chats.tsx          — Chats tab: list of active conversations (mutually-accepted intros)
    profile.tsx        — own profile + settings
  /intro/[id].tsx      — full intro card screen; real data via `getIntroductionDetail` (lib/introductions.ts); Accept/Skip already called the real `respond-to-introduction` Edge Function and now also invalidate the `["incomingIntros", userId]` cache so the Home feed drops the resolved intro on return; `matchAge`/`matchTagline` stay `MOCK_PROFILE_USER` placeholders — `users` has no age/single-line-bio column, same gap as the self side of this screen
  /chat/[id].tsx       — chat thread screen (message bubbles + input; no read receipts, no typing indicator)
  /matchmaker
    select.tsx         — step 1: select two friends (modal sheet off the FAB; mock friend data + per-person eligibility, not per-pair — pair validation is step 2's job; accepts an optional `?preselect=<friendId>` param, seeded into `selectedIds` only when that friend is actually `getFriendEligibility(...) === "eligible"` — an ineligible/unknown preselect id silently falls back to no selection)
    note.tsx           — step 2: write note + send; real send via `sendIntroduction` (send-introduction Edge Function), then invalidates the `["sentIntroductions", userId]` query so the Intros tab picks up the new intro
    prompt-friends.tsx — wingman-only daily-prompt flow: shows today's prompt (lib/prompts.ts) and a single-select list of introducible friends (getIntroducibleFriends, canIntroduce only — not full eligibility) reordered by keyword match against their bio prompts (lib/promptMatch.ts) — never filtered, just reordered; row tap routes to select.tsx with `?preselect=<friendId>`, reusing its existing eligibility fallback unchanged
  /friend/[friendId].tsx — read-only Friend Profile screen; name/photos/prompts/`lookingToGetSetUp` are real data via `getFriendProfile` (lib/friendships.ts) — `meta` stays a hardcoded "BYU · Provo, UT" string, same gap as `/intro/[id].tsx`'s `matchAge`/`matchTagline` (`users` has no age/location column); "Introduce [Name] to someone" (routes to matchmaker select with them preselected) shown only when `lookingToGetSetUp`, "See who [Name] could introduce you to" (stubbed alert — Connections List is a future plan) always shown, plum `secondary` Button variant; FriendProfileHeader always renders a status badge from the same `lookingToGetSetUp` flag — mint "Looking to get set up" when true, plum "Solely a wingman" when false (e.g. in a relationship); reached via FriendsRow avatar taps (wing-me/null-role) or WingCardStack card taps (wing-somebody)
  /request/[friendId].tsx — Flow 2's send screen: bottom-sheet modal (`presentation: "modal"` registered in `app/_layout.tsx`) reached by tapping a `DiscoverPersonCard`; re-derives its own target + mutuals via `getDiscoverPersonDetail(friendId)` (lib/discover.ts, `discover-person` Edge Function) rather than trusting nav params — no `?mutualIds=` query param; sends via the real `requestIntroduction()` (`request-introduction` Edge Function, already existed) and shows `SendConfirmationOverlay` with `message="Your request is on its way"`
/components
  /ui                  — Button, Card, Avatar, Input, Badge, TruncatedText (word-safe line-clamped text; used by any list/card preview instead of raw numberOfLines+ellipsizeMode), TabGlyphs (IntrosGlyph/ChatsGlyph — shared with TabBar so screen-header icons match the tab bar exactly)
  /discover            — DiscoverPersonCard (photo + first-name + meta + plum "via [mutual]" badge from `person.mutuals`, taps into `/request/[id]`; `DiscoverPerson` type now lives in lib/discover.ts — real data, mock fixture removed)
  /home                — HomeHeader (search-icon button opens Discover, next to Invite), IntroFeed, EmptyIntrosState, FriendsRow (small-avatar horizontal row, wing-me/null-role Home screen use), TabBar (custom `tabBar` render prop passed to `<Tabs>` — does its own `state.routes.filter((r) => r.name in TAB_LABELS)` since a custom tab bar does NOT get Expo Router's automatic `href: null` filtering the way the default tab bar UI does; any future hidden `Tabs.Screen` must be excluded here too or it silently eats a flex slot and throws off icon spacing; also filters out `chats` when `profile?.role === "wing-somebody"` — wingman-only users can never receive an intro so Chats would always be empty and duplicate Intros — via its own `useQuery(["userProfile", userId], ...)`, same query key as the Home screen's fetch so it reads from cache rather than double-fetching; the `chats` route stays registered in `_layout.tsx` so `/chat/[id]` still resolves, it's just hidden from the pill for that role), friendsMock (`WingFriend`, `MOCK_FRIENDS` — each entry now carries `imageUri`, its first photo; shared by FriendsRow and WingCardStack), PromptCard (Sunset-gradient card styled like IntroNoteCard; normal state opens /matchmaker/prompt-friends, locked state when introducibleCount < 2 opens the Friend visibility settings coming-soon alert instead — wing-somebody Home screen use), WingCardStack (full-bleed swipeable photo-card carousel + dot indicator, radii.xl + elevation.sm cards, name-over-photo gradient scrim; tap routes to /friend/[friendId] same as FriendsRow's avatars — wing-somebody Home screen use, replaces FriendsRow there)
  /friend               — FriendProfileHeader (`lookingToGetSetUp` prop always renders a status Badge under the meta line — mint "Looking to get set up" or plum "Solely a wingman"), FriendPhotoPromptPanel (read-only siblings of components/profile's editable versions — no edit/upload affordances, so not reused) — Friend Profile screen use; no local mock data anymore, real data comes from `getFriendProfile` (lib/friendships.ts)
  /intro               — IntroCard, IntroNote, MatchmakerChip, mockIntros (now just the `IntroPreview`/`IntroDetail` types — real data comes from lib/introductions.ts's `getIncomingIntroductions`/`getIntroductionDetail`)
  /matchmaker          — FriendPickerChip (3 states: eligible/selected/ineligible; owns the tap-at-cap shake + Warning haptic), FriendPickerGrid (4-col, measures own width via onLayout), MatchmakerEncouragementState (<2-eligible-friends fallback), mockMatchmakerFriends (`MatchmakerFriend`, `getFriendEligibility` — checks `lookingToGetSetUp` before `canIntroduce`/`activePendingCount`, adding a `"not_looking"` eligibility ("Not looking to be set up") for solely-wingman friends, `getIneligibleCaption`, `getIntroducibleFriends` — filters to `canIntroduce: true` only, for the daily-prompt friend list, `MOCK_BIO_TEXT` — bio text keyed by friend id for lib/promptMatch.ts's keyword matching — Step 1 friend-picker screen use)
  /intros              — SentIntroStats (matched stat coral, sent-count stat plum-600), SentIntroRow (pending rows expand in place to show the sent note + Nudge/Withdraw; matched rows never expand — matchmaker firewall), SentIntroList, EmptySentIntrosState, mockSentIntros (now just the `SentIntro` type — real data comes from lib/introductions.ts's `getSentIntroductions`, withdrawn intros excluded from the query entirely rather than shown in a "Withdrawn" state), MatchmakerLeaderboardCard (plum-gradient summary card + full-leaderboard modal, ranked by intros_accepted not intros_sent; entries now real via `getMatchmakerLeaderboardStats`, intros.tsx use), mockLeaderboard (now just the `LeaderboardEntry` type + `rankedLeaderboard` — real data comes from lib/introductions.ts's `getMatchmakerLeaderboardStats`, also used directly by profile.tsx to derive rank/groupSize)
  /chats               — ChatList (owns shared open-row ref + removal animation), ChatRow (presentational, takes `onPress`), SwipeableChatRow (Swipeable wrapper: navigation, haptics, single-open coordination, Mute/Archive/Delete actions), ChatRowActionIcons (Mute/Archive/Delete line icons), EmptyChatsState, mockChats (`unreadCount: number`) (Chats tab: list of active conversations)
  /chat                — MessageBubble, ChatInput, mockMessages (chat thread screen use)
  /profile             — MatchmakerPanel, MatchmakerScoreRing, RankProgressBar, MatchmakerShareCard, ShareScoreModal (share-card capture + native share sheet), ProfileHeader, ProfileSegmentedControl, PhotoPromptPanel, PromptEditorModal, PrivacyPanel, mockProfile (`MatchmakerBadge`/`MatchmakerRankProgress` types only now — the score/rank/badge mock constants were deleted, real values come from lib/matchmakerScore.ts instead; still mock: `MOCK_PROFILE_USER` meta/tagline placeholder, `MOCK_PHOTOS`/`MOCK_PROMPTS` demo defaults, `MOCK_BLOCKED_COUNT`, `MOCK_PRIVACY_SETTINGS`)
  /auth                — PlaneTrailSuccess (OTP-verified success animation)
  /dev                 — DevNav (dev-only screen jumper, __DEV__ gated, mounted in app/_layout.tsx)
/lib
  supabase.ts          — `UserProfileRow.role` ("wing-me" | "wing-somebody" | null) persisted from onboarding, read by the Home screen's role branch
  discover.ts          — `DiscoverPerson` type, `getDiscoverPeople()`/`getDiscoverPersonDetail(targetId)` — thin wrappers over the `discover-people`/`discover-person` Edge Functions (2-hop friends-of-friends computed server-side with the admin client, since `friendships` RLS only lets a user read rows they're a party to); both attach `meta: MOCK_PROFILE_USER.meta` client-side, same placeholder-gap convention as `matchAge`/`matchTagline` on the intro detail screen
  friendships.ts       — `getMatchmakerFriends` (two-step fetch: friendships then users by id, since introductions/friendships have multiple FKs into users — avoids PostgREST embed constraint-hint syntax), `getIntroducersCount` (counts friendships where user_id = the queried user and can_introduce = true — friends who can introduce this user), `getFriendProfile` (single `users` row for `/friend/[friendId]`; relies on the `users_select_self_or_friend` RLS policy rather than its own friendship check — a non-friend id just comes back null; derives `lookingToGetSetUp` from `role !== "wing-somebody"`, same rule as `getMatchmakerFriends`)
  introductions.ts     — `sendIntroduction`, `requestIntroduction`, `respondToIntroduction` (retries once on a 409 compare-and-swap conflict), `withdrawIntroduction`, `nudgeIntroduction`, `getSentIntroductions` (same two-step fetch pattern as friendships.ts; excludes `withdrawn` rows), `getMatchmakerStats` (aggregate introsSent/introsAccepted counts only — matchmaker-firewall rule: no per-intro status exposed; excludes withdrawn intros), `getIncomingIntroductions` (Home feed: rows where the viewer still needs to respond — `both_pending`, or `pending_<their own slot>` — two parallel queries as user_a/user_b then a batch `users` fetch, lightweight `IntroPreview` shape only), `getIntroductionDetail` (single intro + matchmaker/counterpart `users` row for `/intro/[id]`; relies on the `introductions_select_participant` RLS policy rather than its own participant check — a non-participant id just comes back null; both this and `getIncomingIntroductions`' batch `users` fetch also rely on the `users_select_intro_participant` policy (supabase/sql/002_users_friendships_schema.sql) — `users_select_self_or_friend` alone isn't enough since the two people in an intro are usually strangers, not existing friends), `extractFunctionErrorMessage` (shared Edge Function error-body extractor — supabase-js's `FunctionsHttpError.message` is always a generic string, the real server error is only reachable via `.context` as a raw `Response`; used by `matchmaker/note.tsx` and `request/[friendId].tsx` so neither forks its own copy), `getMatchmakerLeaderboardStats` (self + direct friends' `introsSent`/`introsAccepted` via the `matchmaker-leaderboard` Edge Function — RLS blocks a client-side cross-user `introductions` read, same reason `discover-people`/`discover-person` exist)
  matchmakerScore.ts   — pure functions (no I/O): `computeMatchmakerScore`, `computeNextMilestoneCopy`, `computePercentileLabel`, `computeBadges`, `computeRankLevel`, `computeStreak` — turn `getMatchmakerStats` counts + `getMatchmakerLeaderboardStats` rank into the Matchmaker tab's score/badges/tier/level/streak; formulas are a first-pass (score weights, 150-XP/level, badge thresholds), isolated here for easy tuning
  prompts.ts           — `Prompt`, hand-written `PROMPTS` bank (20-30 entries, never AI-generated), `getTodaysPrompt` (day-of-year % bank size — one global prompt/day, no per-user rotation)
  promptMatch.ts       — `sortFriendsByPromptMatch` — whole-word keyword match against friends' bio prompts; reorders only, never filters; bio text comes from `MOCK_BIO_TEXT` in components/matchmaker/mockMatchmakerFriends.ts since the daily-prompt flow (prompt-friends.tsx) is still fully mock end to end
  notifications.ts    — formatMessageNotification, formatIntroNotification, formatIntroNudgeNotification (push copy, hand-synced with supabase/functions/_shared/notificationCopy.ts)
  format.ts            — formatRelativeTime (shared by Chats/Intros list rows)
  haptics.ts
/store
  auth.ts
/constants
  colors.ts            — all tokens from design system above
  spacing.ts           — 4px base scale values
  typography.ts        — font families + scale
```

---

## Privacy Rules (Enforce in Code)

- `status` on introductions NEVER returned to matchmaker endpoint — aggregate counts only
- Messages table has NO `read_at` column. Do not add one.
- `can_introduce` defaults to `false` — explicit opt-in per friend required
- Friend-of-friend browse is scoped — never global profile discovery
- Intro notifications go only to the two recipients

---

## What NOT to Build

- Global profile discovery or swipe feed
- Read receipts or message status of any kind
- Post-intro matchmaker visibility (chat, timestamps, anything)
- Notifications that reveal rejection in any form
- Monetary matchmaker incentives — status/badge only
- AI-generated intro notes — the human note is the entire product

---

## Design Critique Checklist

Before marking any screen done:

- [ ] Contrast — one clear focal point per screen
- [ ] Hierarchy — primary action obvious within 2 seconds
- [ ] Alignment — consistent edge/axis throughout
- [ ] Proximity — related elements grouped, unrelated separated
- [ ] Repetition — same radius, shadow, color used consistently
- [ ] Balance — screen feels visually stable
- [ ] White space — enough breathing room (when in doubt, add more)
- [ ] Unity — every element feels like the same system

---

## Launch Context

- Beachhead: BYU — one sorority + one fraternity first, then expand
- Invite-only: 5 invite tokens per user, join only via invite
- No expansion until 500+ active users on one campus with >40% weekly retention
- Matchmaker badge/score is the status signal — top matchmakers visible within friend group
- Expect sandbox adoption: users test with 1-2 friends before expanding network

---

## Self-Maintenance Rule
After every major implementation (e.g., new api routes, database migrations, state managers, or testing architectural shifts):
1. Update this CLAUDE.md file immediately to reflect the current state.
2. Add new files, paths, or commands to the relevant tables.
3. Log any new "Gotchas & Pitfalls" or newly discovered project conventions.
4. Keep this file under 500 lines; move extensive details to reference files.
