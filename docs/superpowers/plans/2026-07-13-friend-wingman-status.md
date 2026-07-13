# Friend Wingman-Only Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the design in
`docs/superpowers/specs/2026-07-13-friend-wingman-status-design.md` — a new
`lookingToGetSetUp` flag that hides the "Introduce [Name] to someone" action
(and shows a "Solely a wingman" badge) on the Friend Profile screen for
friends who only want to matchmake, and marks the same friends ineligible in
the Matchmaker Step 1 picker.

**Architecture:** Add one new boolean field to the two existing mock data
files that already model friend eligibility/permissions
(`components/friend/mockFriendProfiles.ts`,
`components/matchmaker/mockMatchmakerFriends.ts`). Reuse the existing `Badge`
component (`components/ui/Badge.tsx`, `tone="plum"`) for the status badge —
no new styling primitives needed. Wire the flag into the Friend Profile
screen's existing button-gating logic and the matchmaker picker's existing
`getFriendEligibility`/`getIneligibleCaption` functions.

**Tech Stack:** TypeScript (strict), React Native, Expo Router. No test
runner is configured in this project (no jest, no `test` script in
`package.json`) — verification is `npx tsc --noEmit` plus manual walkthrough
via the running Expo dev server.

## Global Constraints

- Design tokens only — no hardcoded hex/px values; import from
  `constants/colors.ts`, `constants/spacing.ts`, `constants/typography.ts`.
- `lookingToGetSetUp` is independent of `canIntroduce` (per-viewer permission)
  and `connectionsVisible` (friend's own visibility setting) — it is ANDed
  with `canIntroduce` for the "Introduce to someone" button, never replaces
  it.
- "See who [Name] could introduce you to" stays gated by `connectionsVisible`
  alone, unaffected by `lookingToGetSetUp`.
- No badge renders when `lookingToGetSetUp` is `true` (the default state)
  — badge only appears for the `false` (solely-a-wingman) case.
- Badge copy: "Solely a wingman" (title case in code — `Badge`'s own
  `textTransform: "uppercase"` style handles the visual caps, matching the
  existing `Badge label="Mutual friend"` convention in `MatchmakerChip.tsx`).
- Matchmaker picker caption copy: "Not looking to be set up".
- Mock data: only Maya Chen (id `"4"`) gets `lookingToGetSetUp: false`, in
  both mock files. Every other friend gets `true`. This must not change
  Theo Marsh's (`5`) existing `not_opted_in` demo or Ana Sousa's (`6`)
  existing `at_cap` demo.
- Read a file before editing it. Keep files under 500 lines.

---

### Task 1: Add `lookingToGetSetUp` to Friend Profile mock data

**Files:**
- Modify: `components/friend/mockFriendProfiles.ts`

**Interfaces:**
- Produces: `FriendProfile.lookingToGetSetUp: boolean`, consumed by Task 4's
  screen changes.

- [ ] **Step 1: Add the field to the interface**

In `components/friend/mockFriendProfiles.ts`, change:

```ts
export interface FriendProfile {
  id: string;
  name: string;
  meta: string;
  photos: string[];
  prompts: ProfilePrompt[];
  // Mirrors friendships.can_introduce for this friend — gates the
  // "Introduce [Name] to someone" action.
  canIntroduce: boolean;
  // Mirrors this friend's own visibility setting on being asked about via
  // Request an Intro — gates "See who [Name] could introduce you to".
  connectionsVisible: boolean;
}
```

to:

```ts
export interface FriendProfile {
  id: string;
  name: string;
  meta: string;
  photos: string[];
  prompts: ProfilePrompt[];
  // Mirrors friendships.can_introduce for this friend — gates the
  // "Introduce [Name] to someone" action.
  canIntroduce: boolean;
  // Mirrors this friend's own visibility setting on being asked about via
  // Request an Intro — gates "See who [Name] could introduce you to".
  connectionsVisible: boolean;
  // Whether this friend currently wants to be introduced to others at all
  // (independent of canIntroduce/connectionsVisible, which are per-viewer
  // permissions). false = solely a wingman right now — e.g. in a
  // relationship — ANDed with canIntroduce to gate "Introduce to someone";
  // never gates "See who ... could introduce you to".
  lookingToGetSetUp: boolean;
}
```

- [ ] **Step 2: Set the value on all 7 mock entries**

Add `lookingToGetSetUp: true,` right after the `connectionsVisible` line for
every entry **except** Maya Chen (id `"4"`), which gets
`lookingToGetSetUp: false,` instead. Concretely:

Entry `"1"` (Sam Rivera) — change `connectionsVisible: true,` (the one
directly under `canIntroduce: true,` inside the `"1"` object) to:

```ts
    canIntroduce: true,
    connectionsVisible: true,
    lookingToGetSetUp: true,
  },
```

Entry `"2"` (Priya Nair) — same pattern:

```ts
    canIntroduce: true,
    connectionsVisible: true,
    lookingToGetSetUp: true,
  },
```

Entry `"3"` (Jordan Blake):

```ts
    canIntroduce: true,
    connectionsVisible: false,
    lookingToGetSetUp: true,
  },
```

Entry `"4"` (Maya Chen) — the one exception:

```ts
    canIntroduce: true,
    connectionsVisible: true,
    lookingToGetSetUp: false,
  },
```

Entry `"5"` (Theo Marsh):

```ts
    canIntroduce: false,
    connectionsVisible: true,
    lookingToGetSetUp: true,
  },
```

Entry `"6"` (Ana Sousa):

```ts
    canIntroduce: true,
    connectionsVisible: true,
    lookingToGetSetUp: true,
  },
```

Entry `"7"` (Kai Fischer):

```ts
    canIntroduce: true,
    connectionsVisible: false,
    lookingToGetSetUp: true,
  },
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/friend/mockFriendProfiles.ts
git commit -m "feat: add lookingToGetSetUp field to friend profile mock data"
```

---

### Task 2: Add `lookingToGetSetUp` + `not_looking` eligibility to matchmaker mock data

**Files:**
- Modify: `components/matchmaker/mockMatchmakerFriends.ts`

**Interfaces:**
- Produces: `MatchmakerFriend.lookingToGetSetUp: boolean`,
  `FriendEligibility` including `"not_looking"`, updated
  `getFriendEligibility()` and `getIneligibleCaption()` — consumed by
  `app/matchmaker/select.tsx` and `FriendPickerChip.tsx` (both unchanged,
  since they already consume these functions generically).

- [ ] **Step 1: Add the field to the interface**

Change:

```ts
export interface MatchmakerFriend {
  id: string;
  name: string;
  imageUri?: string;
  canIntroduce: boolean; // friendships.can_introduce for this friend -> current user
  activePendingCount: number; // count of introductions where this friend is
                               // user_a_id/user_b_id and status is pending_a/
                               // pending_b/both_pending
}
```

to:

```ts
export interface MatchmakerFriend {
  id: string;
  name: string;
  imageUri?: string;
  canIntroduce: boolean; // friendships.can_introduce for this friend -> current user
  activePendingCount: number; // count of introductions where this friend is
                               // user_a_id/user_b_id and status is pending_a/
                               // pending_b/both_pending
  lookingToGetSetUp: boolean; // false = solely a wingman right now (e.g. in a
                               // relationship) — not eligible to be introduced
                               // to anyone, regardless of canIntroduce
}
```

- [ ] **Step 2: Extend `FriendEligibility` and `getFriendEligibility`**

Change:

```ts
export type FriendEligibility = "eligible" | "not_opted_in" | "at_cap";

export function getFriendEligibility(friend: MatchmakerFriend): FriendEligibility {
  if (!friend.canIntroduce) return "not_opted_in";
  if (friend.activePendingCount >= 3) return "at_cap";
  return "eligible";
}
```

to:

```ts
export type FriendEligibility = "eligible" | "not_opted_in" | "at_cap" | "not_looking";

export function getFriendEligibility(friend: MatchmakerFriend): FriendEligibility {
  if (!friend.lookingToGetSetUp) return "not_looking";
  if (!friend.canIntroduce) return "not_opted_in";
  if (friend.activePendingCount >= 3) return "at_cap";
  return "eligible";
}
```

- [ ] **Step 3: Add the caption**

Change:

```ts
export function getIneligibleCaption(eligibility: FriendEligibility): string | undefined {
  if (eligibility === "not_opted_in") return "Hasn't opted in";
  if (eligibility === "at_cap") return "3 pending intros";
  return undefined;
}
```

to:

```ts
export function getIneligibleCaption(eligibility: FriendEligibility): string | undefined {
  if (eligibility === "not_looking") return "Not looking to be set up";
  if (eligibility === "not_opted_in") return "Hasn't opted in";
  if (eligibility === "at_cap") return "3 pending intros";
  return undefined;
}
```

- [ ] **Step 4: Set the value on all 7 mock entries**

Change:

```ts
export const MOCK_MATCHMAKER_FRIENDS: MatchmakerFriend[] = [
  { id: "1", name: "Sam Rivera", canIntroduce: true, activePendingCount: 0 },
  { id: "2", name: "Priya Nair", canIntroduce: true, activePendingCount: 1 },
  { id: "3", name: "Jordan Blake", canIntroduce: true, activePendingCount: 0 },
  { id: "4", name: "Maya Chen", canIntroduce: true, activePendingCount: 0 },
  { id: "5", name: "Theo Marsh", canIntroduce: false, activePendingCount: 0 },
  { id: "6", name: "Ana Sousa", canIntroduce: true, activePendingCount: 3 },
  { id: "7", name: "Kai Fischer", canIntroduce: true, activePendingCount: 2 },
];
```

to:

```ts
export const MOCK_MATCHMAKER_FRIENDS: MatchmakerFriend[] = [
  { id: "1", name: "Sam Rivera", canIntroduce: true, activePendingCount: 0, lookingToGetSetUp: true },
  { id: "2", name: "Priya Nair", canIntroduce: true, activePendingCount: 1, lookingToGetSetUp: true },
  { id: "3", name: "Jordan Blake", canIntroduce: true, activePendingCount: 0, lookingToGetSetUp: true },
  { id: "4", name: "Maya Chen", canIntroduce: true, activePendingCount: 0, lookingToGetSetUp: false },
  { id: "5", name: "Theo Marsh", canIntroduce: false, activePendingCount: 0, lookingToGetSetUp: true },
  { id: "6", name: "Ana Sousa", canIntroduce: true, activePendingCount: 3, lookingToGetSetUp: true },
  { id: "7", name: "Kai Fischer", canIntroduce: true, activePendingCount: 2, lookingToGetSetUp: true },
];
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add components/matchmaker/mockMatchmakerFriends.ts
git commit -m "feat: add not_looking eligibility for solely-wingman friends"
```

---

### Task 3: Wingman badge support in `FriendProfileHeader`

**Files:**
- Modify: `components/friend/FriendProfileHeader.tsx`

**Interfaces:**
- Consumes: `Badge` from `components/ui/Badge.tsx`
  (`{ label: string; variant?: "solid" | "outline"; tone?: "coral" | "mint" | "butter" | "plum"; textColor?: string }`).
- Produces: `FriendProfileHeader({ name, meta, avatarUri, showWingmanBadge? }: { name: string; meta: string; avatarUri?: string; showWingmanBadge?: boolean })`,
  consumed by Task 4's screen changes.

- [ ] **Step 1: Add the import and prop**

Change:

```tsx
import { Text, View } from "react-native";
import { Avatar } from "../ui/Avatar";
import { ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

interface FriendProfileHeaderProps {
  name: string;
  meta: string;
  avatarUri?: string;
}

export function FriendProfileHeader({ name, meta, avatarUri }: FriendProfileHeaderProps) {
```

to:

```tsx
import { Text, View } from "react-native";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { ink } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

interface FriendProfileHeaderProps {
  name: string;
  meta: string;
  avatarUri?: string;
  // Shows a "Solely a wingman" badge under the meta line. Omit or pass
  // false for friends who are looking to get set up (the default state
  // gets no badge at all).
  showWingmanBadge?: boolean;
}

export function FriendProfileHeader({ name, meta, avatarUri, showWingmanBadge }: FriendProfileHeaderProps) {
```

- [ ] **Step 2: Render the badge under the meta text**

Change:

```tsx
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.sm[0],
            lineHeight: fontSize.sm[1],
            color: ink[500],
          }}
          numberOfLines={1}
        >
          {meta}
        </Text>
      </View>
    </View>
  );
}
```

to:

```tsx
        <Text
          style={{
            fontFamily: fonts.body,
            fontSize: fontSize.sm[0],
            lineHeight: fontSize.sm[1],
            color: ink[500],
          }}
          numberOfLines={1}
        >
          {meta}
        </Text>
        {showWingmanBadge && (
          <View style={{ marginTop: 4 }}>
            <Badge label="Solely a wingman" tone="plum" />
          </View>
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/friend/FriendProfileHeader.tsx
git commit -m "feat: add wingman-only badge to FriendProfileHeader"
```

---

### Task 4: Wire button gating + badge into the Friend Profile screen, verify both screens

**Files:**
- Modify: `app/friend/[friendId].tsx:79,80-88`

**Interfaces:**
- Consumes: `FriendProfile.lookingToGetSetUp` (Task 1),
  `FriendProfileHeader`'s `showWingmanBadge` prop (Task 3).
- Produces: nothing new consumed by later tasks — this is the terminal
  wiring task for this plan.

- [ ] **Step 1: Pass the badge prop to `FriendProfileHeader`**

Change:

```tsx
        <FriendProfileHeader name={friend.name} meta={friend.meta} avatarUri={friend.photos[0]} />
```

to:

```tsx
        <FriendProfileHeader
          name={friend.name}
          meta={friend.meta}
          avatarUri={friend.photos[0]}
          showWingmanBadge={!friend.lookingToGetSetUp}
        />
```

- [ ] **Step 2: Gate the "Introduce to someone" button on the new flag**

Change:

```tsx
          {friend.canIntroduce && (
            <Button
              title={`Introduce ${firstName} to someone`}
              onPress={() => router.push(`/matchmaker/select?preselect=${friend.id}` as never)}
            />
          )}
```

to:

```tsx
          {friend.canIntroduce && friend.lookingToGetSetUp && (
            <Button
              title={`Introduce ${firstName} to someone`}
              onPress={() => router.push(`/matchmaker/select?preselect=${friend.id}` as never)}
            />
          )}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification**

The Expo dev server is already running (per this session's earlier restart)
at `exp://<lan-ip>:8081` / `http://localhost:8081`. Reload the app (shake
device / press `r` in the terminal running `expo start`) to pick up the
change, then:

- Navigate to Maya Chen's Friend Profile (id `"4"` — via DevNav "Friend
  profile" shortcut then manually changing the id in the URL, or by finding
  a FriendsRow avatar that maps to id `4`). Confirm:
  - A "Solely a wingman" badge (plum pill) renders under her meta line.
  - Only "See who Maya could introduce you to" renders — "Introduce Maya to
    someone" is absent.
- Navigate to Sam Rivera's profile (id `"1"`). Confirm no badge renders and
  both buttons still show, unchanged from before this plan.
- Open Matchmaker Step 1 (FAB → select, or DevNav shortcut). Confirm:
  - Maya Chen's chip is disabled (dimmed) with caption "Not looking to be
    set up".
  - Theo Marsh's chip still shows "Hasn't opted in" and Ana Sousa's chip
    still shows "3 pending intros" — unaffected by this change.
  - Every other friend's chip remains fully interactive.

- [ ] **Step 5: Commit**

```bash
git add app/friend/\[friendId\].tsx
git commit -m "feat: gate Introduce button and show wingman badge on Friend Profile"
```

---

## Out of scope

- No settings UI for a user to toggle their own `lookingToGetSetUp` — mock
  data only, per the spec's "Out of Scope" section.
- No changes to onboarding intent (`wing-me`/`wing-somebody`) — confirmed
  separate concept per the approved spec.
- No Supabase wiring — both mock files stay static, matching the fidelity of
  every other mock data file in this codebase today.
