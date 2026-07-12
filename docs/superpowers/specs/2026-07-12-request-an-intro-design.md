# Request an Intro (Flow 2) + Nudge

## Summary

Design for Flow 2 from CLAUDE.md ("User-initiated intro"), which does not exist
in the codebase yet — no Discover tab, no friend profile screen, no
`/request/[friendId]` route. Scope covers the full loop: browsing a specific
friend's connections, requesting an intro through them, the mutual friend
approving/declining, status tracking, and nudging a mutual friend who hasn't
responded. On approval, a request becomes a normal Flow 1 introduction and
reuses all existing accept/pass/chat/firewall machinery — no new post-match
surface is built.

Entry point is **per-friend, not a global directory**: there is no dedicated
"Discover" tab. You reach another person's connections by first opening a
specific friend's profile (a screen that also doesn't exist yet) and choosing
"see who they could introduce you to." This keeps browsing scoped to
friends-of-friends as CLAUDE.md requires, without adding a 5th nav item or
competing with the FAB (which stays dedicated to the matchmaker flow).

## 1. Data model

New Supabase table:

```
intro_requests
  id                uuid, pk
  requester_id      uuid, fk -> users.id      -- person asking for the intro
  mutual_friend_id  uuid, fk -> users.id      -- friend being asked to make it
  target_id         uuid, fk -> users.id      -- person requester wants to meet
  status            enum: pending | approved | declined
  created_at        timestamptz
  last_nudged_at    timestamptz, nullable
```

**On approval** (`mutual_friend_id` accepts): a new row is inserted into the
existing `introductions` table with `matchmaker_id = mutual_friend_id`,
`user_a_id = requester_id`, `user_b_id = target_id`, `note = ''` (no note —
the human note is Flow 1's product; a request has no equivalent), and
`status = both_pending`. From that moment the row behaves exactly like a
matchmaker-sent intro: appears in both recipients' Home feeds, subject to the
existing accept/pass/silent-rejection/firewall rules. `intro_requests.status`
becomes `approved` and the row stops appearing in "Waiting on you."

**On decline**: `intro_requests.status = declined`. No row is created in
`introductions`. The target person is never contacted or notified — they have
no visibility into the request ever having existed. The requester sees a
neutral "intro not available" message (per CLAUDE.md Flow 2 step 5), with no
reason surfaced, matching the app's silent-rejection philosophy.

**On withdraw** (requester cancels before mutual friend responds): row is
deleted (or `status` set to a terminal `withdrawn` state — implementation
detail, functionally equivalent since neither surfaces anywhere). No
notification to the mutual friend.

## 2. Screens & navigation

### 2a. Friend Profile — `app/friend/[friendId].tsx` (new)

Read-only view of a friend's photos/prompts (same content shape as the
existing own-profile screen, minus edit controls). Reached by tapping a
friend avatar wherever one appears (Home's `FriendsRow`, a chat header,
etc.) — this finally wires up the `handleFriendPress` TODO in
`components/home/FriendsRow.tsx`, which currently no-ops.

Two actions at the bottom:
- **"Introduce [Name] to someone"** → routes into the existing matchmaker
  flow (`app/matchmaker/select.tsx`) with this friend preselected. This is
  what the `FriendsRow` TODO originally intended.
- **"See who [Name] could introduce you to"** → only rendered if the friend's
  visibility settings permit it (reuse the `can_introduce`/eligibility
  concept from `components/matchmaker/mockMatchmakerFriends.ts`); otherwise
  omitted entirely, no explanation shown.

### 2b. Connections list — modal or `app/friend/[friendId]/connections.tsx`

Grid/list of the chosen friend's other friends who are on Wing and not
already the viewer's friends (friends-of-friends, scoped to this one person —
never a global directory, per CLAUDE.md). Tapping a person opens a minimal
target preview (photo, name) with a **"Request intro through [Mutual]"** CTA.

### 2c. Request confirmation sheet

Lightweight confirm step: *"Ask Maya to introduce you to Sam?"* Confirming
creates the `intro_requests` row and sends the mutual friend a push
notification ("Jordan wants you to introduce them to Sam").

If the requester already has 3 outstanding (`pending`) requests, the CTA in
2b is disabled with an inline explainer instead of reaching this sheet.

### 2d. Intros tab restructure — `app/(tabs)/intros.tsx`

Add a segmented control at the top: **Sent** / **Requested**.

- **Sent** — unchanged, today's `SentIntroList` (matchmaker notes you wrote).
- **Requested** — two sections:
  - *Waiting on you* — requests where the current user is `mutual_friend_id`.
    Each row has Approve/Decline actions.
  - *Your requests* — requests the current user sent as `requester_id`.
    Status badge (Pending/Approved/Declined); Pending rows get Nudge/Withdraw
    actions, built as a sibling component to `SentIntroRow` reusing its
    expand-in-place pattern (avatar pair, tap-to-expand, `InlineAction`
    buttons) rather than duplicating the animation/layout code.

## 3. Nudge

Reuses the existing `InlineAction` component pattern from `SentIntroRow`
(label, `plum[100]` bg, `plum[600]` text). Tapping it on a pending "Your
requests" row sends the mutual friend a reminder push.

**48-hour cooldown**, enforced server-side via `last_nudged_at` — not just
hidden client-side. While on cooldown the button shows a disabled "Nudged"
state rather than disappearing, so the requester has confirmation it went
through.

## 4. Anti-spam limits

Two independent caps, checked sequentially rather than stacked:

1. **Outstanding requests**: max 3 `intro_requests` rows with
   `status = pending` per requester, server-enforced at creation (2c). Mirrors
   the existing "max 3 active pending intros" limit in spirit but is tracked
   separately, since an unapproved request only affects the mutual friend
   being asked — the target person isn't bothered by it at all.
2. **Active intros**: once a request is approved and becomes a row in
   `introductions`, it's subject to the existing, unchanged 3-active-intro
   cap from Flow 1. A request that's merely pending approval does not count
   against this cap.

## 5. Privacy / edge cases

- The target person has zero visibility into a request's existence unless and
  until it's approved — consistent with "matchmaker firewall" and silent
  rejection elsewhere in the app.
- "See who [Name] could introduce you to" is omitted (not disabled) when that
  friend's visibility settings don't permit it.
- Declining, like passing an intro, is silent to the requester beyond the
  neutral "not available" message — no read receipts, no explanation.

## Out of scope

- No global/global-search friend-of-friend directory — browsing is always
  entered through a specific friend's profile.
- No changes to the FAB, bottom nav tab count, or the matchmaker (Flow 1)
  flow itself beyond the one new entry point in Friend Profile.
- No backend/Supabase wiring in this spec — matches the fidelity of prior
  specs in this repo (e.g. chats swipe actions), implementation plan will
  determine mock-vs-real data scope.
