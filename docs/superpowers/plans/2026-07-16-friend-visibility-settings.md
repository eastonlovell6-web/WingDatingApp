# Friend Visibility Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the last unbuilt v1 screen — `app/settings/friend-visibility.tsx` — letting a user toggle `can_introduce` per friend, replacing the `comingSoon("Friend visibility settings")` stub `PrivacyPanel`'s "Who can introduce you" row currently falls back to.

**Architecture:** A new `friendships` UPDATE RLS policy + grant (currently missing entirely — `friendships` has never supported writes), three new functions in `lib/friendships.ts` (`getFriendVisibilityList`, `setFriendCanIntroduce`, `setAllFriendsCanIntroduce`) reusing the existing two-step fetch pattern (`friendships` then `users`), and a new screen that reuses `components/onboarding/FriendVisibilityList`/`FriendVisibilityRow` (built for onboarding, now widened with two optional props) restyled inside `PrivacyPanel`'s `GroupCard` so it reads as a Profile/Settings surface rather than an onboarding step.

**Tech Stack:** TypeScript (strict), Supabase JS client (untyped — no generated `Database` types in this repo), React Query, Expo Router (`typedRoutes: true` per `app.json`). No test framework exists in this repo (verified: no jest config, no `*.test.*` files anywhere, `package.json` has no `test` script) — verification is `npx tsc --noEmit` plus manual app run, matching every prior Supabase-wiring plan in this repo.

## Global Constraints

- TypeScript strict mode always on — every new function fully types its params and return value.
- `can_introduce` defaults to `false` — explicit opt-in per friend required (CLAUDE.md Privacy Rules). Never a step in this plan should default a toggle to `true` except in direct response to a user's own Select All action.
- No add-friend / contacts-sync flow in this screen — it only operates on `friendships` rows that already exist (spec's explicit scope boundary).
- Keep files under 500 lines.
- Do not add automated tests where none of this project's precedent added any — verify via typecheck + manual run instead.
- The SQL file this plan creates must be hand-applied by a human in the Supabase SQL Editor — this repo has no migrations runner, and no task in this plan can apply it for you.
- `router.push` to a route created earlier in this same plan should be cast `as never`, matching the majority convention already in this codebase (`app/(tabs)/index.tsx:77`, `components/home/PromptCard.tsx:31`, `components/home/TabBar.tsx:102`) for routes whose generated Expo Router types may not have regenerated yet.

---

### Task 1: Database migration — `friendships` UPDATE policy

**Files:**
- Create: `supabase/sql/006_friendships_update_policy.sql`

**Interfaces:**
- Consumes: nothing (raw SQL, no app code dependency).
- Produces: the `friendships_update_own` RLS policy and an `UPDATE` grant that Task 2's `setFriendCanIntroduce`/`setAllFriendsCanIntroduce` require to succeed against a real Supabase project. Nothing in this codebase can verify this file was actually applied — that's a manual step for the user.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/sql/006_friendships_update_policy.sql
-- Hand-apply in the Supabase SQL Editor (see 001_notifications_schema.sql —
-- this project has no migrations folder).
--
-- friendships had no UPDATE policy — 002_users_friendships_schema.sql
-- flagged this as a known gap ("Add an insert/update policy here when that
-- screen ships"). The Friend Visibility Settings screen needs to let a user
-- toggle can_introduce on their own friendships rows.
--
-- Also grants UPDATE on the base table: 004_grant_friendships_select.sql
-- already hit this same gap for SELECT (raw SQL table creation doesn't
-- auto-grant base privileges to `authenticated` the way the Studio Table
-- Editor does) — without this grant, Postgres throws "permission denied for
-- table friendships" on any UPDATE attempt regardless of the RLS policy
-- below, since the base grant is checked before RLS policies apply.
grant update on public.friendships to authenticated;

-- Same trust model as `users`' self-update policy: no column-level lock,
-- the client is trusted to only ever write can_introduce. auth.uid() =
-- user_id in both `using` and `with check` means a user can only update
-- rows where they are the granting party (see lib/friendships.ts's
-- direction convention comment on getMatchmakerFriends), and can't
-- reassign user_id/friend_id to someone else's identity.
create policy "friendships_update_own" on friendships
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/sql/006_friendships_update_policy.sql
git commit -m "feat: add friendships UPDATE policy for Friend Visibility Settings"
```

**Note for the user (surface this after the plan finishes, don't skip):** this file must be run by hand in the Supabase SQL Editor before toggles in the new screen will actually persist. Until then, toggling a friend will optimistically update the UI, log a permission error to the console, and silently fail to save.

---

### Task 2: `lib/friendships.ts` — visibility list + mutations

**Files:**
- Modify: `lib/friendships.ts` (append after `getIntroducersCount`, currently ending at line 134)

**Interfaces:**
- Consumes: `supabase` client from `./supabase` (already imported at top of file).
- Produces:
  - `export interface FriendVisibilityEntry { id: string; name: string; imageUri?: string; canIntroduce: boolean; createdAt: string; isNew: boolean }`
  - `export async function getFriendVisibilityList(userId: string): Promise<FriendVisibilityEntry[]>`
  - `export async function setFriendCanIntroduce(userId: string, friendId: string, canIntroduce: boolean): Promise<void>`
  - `export async function setAllFriendsCanIntroduce(userId: string, friendIds: string[], canIntroduce: boolean): Promise<void>`
  - Task 4 imports all four.

- [ ] **Step 1: Append the new code**

Add to the end of `lib/friendships.ts`:

```ts

const NEW_FRIEND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface FriendVisibilityEntry {
  id: string;
  name: string;
  imageUri?: string;
  canIntroduce: boolean;
  createdAt: string;
  isNew: boolean;
}

/**
 * The signed-in user's own friendships rows (user_id = userId — the
 * direction that represents "friends I've granted, or could grant,
 * permission to introduce me"; see getMatchmakerFriends above for the
 * opposite direction). Sorted new-first (most recently joined at the top,
 * newest to oldest within that group), then everyone else alphabetically —
 * Friend Visibility Settings screen use.
 */
export async function getFriendVisibilityList(userId: string): Promise<FriendVisibilityEntry[]> {
  const { data: friendshipRows, error: friendshipsError } = await supabase
    .from("friendships")
    .select("friend_id, can_introduce, created_at")
    .eq("user_id", userId);
  if (friendshipsError) throw friendshipsError;

  const friendIds: string[] = (friendshipRows ?? []).map((row) => row.friend_id);
  if (friendIds.length === 0) return [];

  const rowByFriendId = new Map((friendshipRows ?? []).map((row) => [row.friend_id, row]));

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, name, photos")
    .in("id", friendIds);
  if (usersError) throw usersError;

  const now = Date.now();
  const entries: FriendVisibilityEntry[] = (users ?? []).map((user) => {
    const row = rowByFriendId.get(user.id)!;
    return {
      id: user.id,
      name: user.name,
      imageUri: user.photos?.[0] ?? undefined,
      canIntroduce: row.can_introduce,
      createdAt: row.created_at,
      isNew: now - new Date(row.created_at).getTime() < NEW_FRIEND_WINDOW_MS,
    };
  });

  return entries.sort((a, b) => {
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
    if (a.isNew) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return a.name.localeCompare(b.name);
  });
}

/**
 * Toggle whether a single friend can introduce the signed-in user. Requires
 * the friendships_update_own RLS policy
 * (supabase/sql/006_friendships_update_policy.sql) — without it this
 * throws a permission error.
 */
export async function setFriendCanIntroduce(
  userId: string,
  friendId: string,
  canIntroduce: boolean
): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .update({ can_introduce: canIntroduce })
    .eq("user_id", userId)
    .eq("friend_id", friendId);
  if (error) throw error;
}

/**
 * Bulk version of setFriendCanIntroduce for the Select All / None quick
 * actions on the Friend Visibility Settings screen.
 */
export async function setAllFriendsCanIntroduce(
  userId: string,
  friendIds: string[],
  canIntroduce: boolean
): Promise<void> {
  if (friendIds.length === 0) return;
  const { error } = await supabase
    .from("friendships")
    .update({ can_introduce: canIntroduce })
    .eq("user_id", userId)
    .in("friend_id", friendIds);
  if (error) throw error;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `lib/friendships.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/friendships.ts
git commit -m "feat: add getFriendVisibilityList and can_introduce mutations"
```

---

### Task 3: Widen `FriendVisibilityRow`/`FriendVisibilityList`, export `GroupCard`

**Files:**
- Modify: `components/onboarding/FriendVisibilityRow.tsx`
- Modify: `components/onboarding/FriendVisibilityList.tsx`
- Modify: `components/profile/PrivacyPanel.tsx`

**Interfaces:**
- Consumes: nothing new — pure prop-surface widening of existing components.
- Produces:
  - `FriendVisibilityRow` accepts two new optional props: `isNew?: boolean`, `caption?: string`.
  - `FriendVisibilityList`'s `friends` prop type becomes `{ id: string; name: string; isNew?: boolean; caption?: string }[]`.
  - `export function GroupCard` from `components/profile/PrivacyPanel.tsx` (currently unexported) — Task 4 imports it.

- [ ] **Step 1: Add `isNew`/`caption` to `FriendVisibilityRow`**

Current (`components/onboarding/FriendVisibilityRow.tsx`, full file):

```tsx
import { View, Text, Switch, Platform } from "react-native";
import { coral, ink, plum, surface } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { radii } from "../../constants/spacing";

// Alternating tint so a long list of initials avatars doesn't read as flat.
const TINTS = [
  { bg: plum[100], text: plum[600] },
  { bg: coral[100], text: coral[600] },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function FriendVisibilityRow({
  id,
  name,
  index,
  value,
  onToggle,
}: {
  id: string;
  name: string;
  index: number;
  value: boolean;
  onToggle: (id: string) => void;
}) {
  const tint = TINTS[index % TINTS.length];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        gap: 14,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radii.pill,
          backgroundColor: tint.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: tint.text }}>
          {initials(name)}
        </Text>
      </View>

      <Text
        style={{
          flex: 1,
          fontFamily: fonts.body,
          fontSize: 16,
          color: ink[900],
        }}
      >
        {name}
      </Text>

      <Switch
        value={value}
        onValueChange={() => onToggle(id)}
        trackColor={{ false: ink[300], true: coral[500] }}
        thumbColor={Platform.OS === "android" ? surface.paper : undefined}
        ios_backgroundColor={ink[300]}
      />
    </View>
  );
}
```

Replace with:

```tsx
import { View, Text, Switch, Platform } from "react-native";
import { coral, ink, plum, surface } from "../../constants/colors";
import { fonts } from "../../constants/typography";
import { radii } from "../../constants/spacing";
import { Badge } from "../ui/Badge";

// Alternating tint so a long list of initials avatars doesn't read as flat.
const TINTS = [
  { bg: plum[100], text: plum[600] },
  { bg: coral[100], text: coral[600] },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function FriendVisibilityRow({
  id,
  name,
  index,
  value,
  onToggle,
  isNew,
  caption,
}: {
  id: string;
  name: string;
  index: number;
  value: boolean;
  onToggle: (id: string) => void;
  isNew?: boolean;
  caption?: string;
}) {
  const tint = TINTS[index % TINTS.length];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        gap: 14,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radii.pill,
          backgroundColor: tint.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 15, color: tint.text }}>
          {initials(name)}
        </Text>
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 16, color: ink[900] }}>{name}</Text>
          {isNew && <Badge label="NEW" tone="butter" />}
        </View>
        {caption && (
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: ink[500] }}>{caption}</Text>
        )}
      </View>

      <Switch
        value={value}
        onValueChange={() => onToggle(id)}
        trackColor={{ false: ink[300], true: coral[500] }}
        thumbColor={Platform.OS === "android" ? surface.paper : undefined}
        ios_backgroundColor={ink[300]}
      />
    </View>
  );
}
```

- [ ] **Step 2: Pass `isNew`/`caption` through in `FriendVisibilityList`**

Current (`components/onboarding/FriendVisibilityList.tsx`), the function signature and the row-mapping block:

```tsx
export function FriendVisibilityList({
  friends,
  visibility,
  onToggle,
  onSelectAll,
  onSelectNone,
}: {
  friends: { id: string; name: string }[];
  visibility: Record<string, boolean>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}) {
```

Replace with:

```tsx
export function FriendVisibilityList({
  friends,
  visibility,
  onToggle,
  onSelectAll,
  onSelectNone,
}: {
  friends: { id: string; name: string; isNew?: boolean; caption?: string }[];
  visibility: Record<string, boolean>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}) {
```

Current row-mapping block:

```tsx
        {filtered.map((friend, i) => (
          <FriendVisibilityRow
            key={friend.id}
            id={friend.id}
            name={friend.name}
            index={i}
            value={visibility[friend.id] ?? false}
            onToggle={onToggle}
          />
        ))}
```

Replace with:

```tsx
        {filtered.map((friend, i) => (
          <FriendVisibilityRow
            key={friend.id}
            id={friend.id}
            name={friend.name}
            index={i}
            value={visibility[friend.id] ?? false}
            onToggle={onToggle}
            isNew={friend.isNew}
            caption={friend.caption}
          />
        ))}
```

- [ ] **Step 3: Export `GroupCard` from `PrivacyPanel.tsx`**

Current (`components/profile/PrivacyPanel.tsx`, around line 18):

```tsx
function GroupCard({ children }: { children: React.ReactNode }) {
```

Replace with:

```tsx
export function GroupCard({ children }: { children: React.ReactNode }) {
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. Onboarding's existing usage of `FriendVisibilityList`/`FriendVisibilityRow` (passing plain `{id, name}` objects, no `isNew`/`caption`) must still typecheck — both new props are optional.

- [ ] **Step 5: Commit**

```bash
git add components/onboarding/FriendVisibilityRow.tsx components/onboarding/FriendVisibilityList.tsx components/profile/PrivacyPanel.tsx
git commit -m "feat: add NEW badge/caption support to FriendVisibilityRow, export GroupCard"
```

---

### Task 4: New screen `app/settings/friend-visibility.tsx`

**Files:**
- Create: `app/settings/friend-visibility.tsx`

**Interfaces:**
- Consumes:
  - `getFriendVisibilityList(userId: string): Promise<FriendVisibilityEntry[]>`, `setFriendCanIntroduce(userId, friendId, canIntroduce): Promise<void>`, `setAllFriendsCanIntroduce(userId, friendIds, canIntroduce): Promise<void>` from Task 2.
  - `FriendVisibilityList` (widened props) from Task 3.
  - `GroupCard` (now exported) from Task 3.
  - `formatRelativeTime(iso: string): string` from `lib/format.ts` (pre-existing).
- Produces: the `/settings/friend-visibility` route — Task 5 links to it.

- [ ] **Step 1: Write the screen**

```tsx
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { GroupCard } from "../../components/profile/PrivacyPanel";
import { FriendVisibilityList } from "../../components/onboarding/FriendVisibilityList";
import { coral, ink, surface } from "../../constants/colors";
import { fonts, fontSize, textStyles } from "../../constants/typography";
import { spacing } from "../../constants/spacing";
import { useAuthStore } from "../../store/auth";
import {
  getFriendVisibilityList,
  setAllFriendsCanIntroduce,
  setFriendCanIntroduce,
} from "../../lib/friendships";
import { formatRelativeTime } from "../../lib/format";

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 8 12l7 7" stroke={ink[900]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function friendCaption(createdAt: string, isNew: boolean): string {
  if (isNew) return `Joined ${formatRelativeTime(createdAt)}`;
  const month = new Date(createdAt).toLocaleDateString("en-US", { month: "long" });
  return `Friend since ${month}`;
}

export default function FriendVisibilityScreen() {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  const { data: friends, isLoading } = useQuery({
    queryKey: ["friendVisibilityList", userId],
    queryFn: () => getFriendVisibilityList(userId!),
    enabled: !!userId,
  });

  const [visibility, setVisibility] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!friends) return;
    setVisibility(Object.fromEntries(friends.map((f) => [f.id, f.canIntroduce])));
  }, [friends]);

  function invalidateIntroducersCount() {
    if (userId) queryClient.invalidateQueries({ queryKey: ["introducersCount", userId] });
  }

  function handleToggle(friendId: string) {
    const next = !visibility[friendId];
    setVisibility((prev) => ({ ...prev, [friendId]: next }));
    if (!userId) return;
    setFriendCanIntroduce(userId, friendId, next)
      .then(invalidateIntroducersCount)
      .catch((err) => console.error("Failed to update friend visibility:", err));
  }

  function handleSelectAll() {
    if (!friends || friends.length === 0) return;
    setVisibility(Object.fromEntries(friends.map((f) => [f.id, true])));
    if (!userId) return;
    setAllFriendsCanIntroduce(
      userId,
      friends.map((f) => f.id),
      true
    )
      .then(invalidateIntroducersCount)
      .catch((err) => console.error("Failed to update friend visibility:", err));
  }

  function handleSelectNone() {
    if (!friends || friends.length === 0) return;
    setVisibility(Object.fromEntries(friends.map((f) => [f.id, false])));
    if (!userId) return;
    setAllFriendsCanIntroduce(
      userId,
      friends.map((f) => f.id),
      false
    )
      .then(invalidateIntroducersCount)
      .catch((err) => console.error("Failed to update friend visibility:", err));
  }

  const listItems = (friends ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    isNew: f.isNew,
    caption: friendCaption(f.createdAt, f.isNew),
  }));

  return (
    <View style={{ flex: 1, backgroundColor: surface.cream }}>
      <View
        style={{
          paddingTop: insets.top + spacing[2],
          paddingBottom: spacing[2],
          paddingHorizontal: spacing[4],
        }}
      >
        <Pressable
          onPress={() => router.canGoBack() && router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <BackIcon />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: spacing[6], gap: spacing[2], marginBottom: spacing[6] }}>
        <Text style={textStyles.heading}>Friend visibility</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: fontSize.base[0], color: ink[500] }}>
          Choose who can introduce you
        </Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: spacing[6], paddingBottom: insets.bottom + spacing[8] }}>
        {isLoading && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={coral[500]} />
          </View>
        )}

        {!isLoading && listItems.length === 0 && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing[6] }}>
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: fontSize.base[0],
                color: ink[500],
                textAlign: "center",
              }}
            >
              You don&apos;t have any friends on Wing yet.
            </Text>
          </View>
        )}

        {!isLoading && listItems.length > 0 && (
          <GroupCard>
            <View style={{ padding: spacing[4] }}>
              <FriendVisibilityList
                friends={listItems}
                visibility={visibility}
                onToggle={handleToggle}
                onSelectAll={handleSelectAll}
                onSelectNone={handleSelectNone}
              />
            </View>
          </GroupCard>
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `app/settings/friend-visibility.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/settings/friend-visibility.tsx
git commit -m "feat: build Friend Visibility Settings screen"
```

---

### Task 5: Wire `profile.tsx` to the new screen, manual verification

**Files:**
- Modify: `app/(tabs)/profile.tsx`

**Interfaces:**
- Consumes: the `/settings/friend-visibility` route from Task 4.
- Produces: nothing further consumed by other tasks (last task).

- [ ] **Step 1: Import `router`**

Current top of `app/(tabs)/profile.tsx`:

```ts
import { useEffect, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
```

Replace with:

```ts
import { useEffect, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { router } from "expo-router";
```

- [ ] **Step 2: Replace the stub**

Current (line 288):

```tsx
              onVisibilityPress={() => comingSoon("Friend visibility settings")}
```

Replace with:

```tsx
              onVisibilityPress={() => router.push("/settings/friend-visibility" as never)}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/profile.tsx
git commit -m "feat: link Privacy tab to the Friend Visibility Settings screen"
```

- [ ] **Step 5: Manual verification**

Run: `npx expo start --web` (or `npx expo start` for a device/simulator if available)

- Navigate to Profile tab → Privacy segment → "Who can introduce you" row → confirm it now pushes to the new screen instead of an alert.
- If the signed-in test user has at least one `friendships` row where `user_id` = them: confirm the list renders, confirm any friend with `created_at` inside the last 7 days shows the `NEW` badge and sits above older friends, confirm alphabetical order otherwise.
- If `006_friendships_update_policy.sql` has been applied: toggle a friend off, confirm it persists (reload the screen, still off). Navigate back to the Privacy tab, confirm `introducersCount` reflects the change.
- If the SQL has **not** been applied yet: toggle a friend, confirm the switch still visually flips (optimistic update) and a permission error is logged to the console rather than the app crashing.
- Test Select All and Select None against a multi-friend list, confirm every row's switch updates together.
- Test the zero-friends case (a fresh test account with no `friendships` rows): confirm the "You don't have any friends on Wing yet." empty state renders, no crash.
- Note: no iOS/Android simulator is available in this environment — if only web preview is available, be aware of known RN-web auth/preview gotchas (see project memory) and flag any check that genuinely needs a native device as still owed to the user.
- Remind the user directly, in the final summary, that `supabase/sql/006_friendships_update_policy.sql` still needs to be run by hand in the Supabase SQL Editor if it hasn't been already — this plan cannot do that step for them.

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers the missing UPDATE policy (spec's "Database change" section). Task 2 covers `getFriendVisibilityList`/`setFriendCanIntroduce`/`setAllFriendsCanIntroduce` plus the 7-day `isNew` threshold and new-first-then-alphabetical sort (spec's "Data model" and "Implementation" sections). Task 3 covers the `FriendVisibilityRow` badge/caption widening and `GroupCard` export (spec's component-reuse decision). Task 4 covers the screen itself — header, loading/empty states, optimistic toggle + invalidation, Select All/None (spec's "Implementation" screen section). Task 5 covers wiring `profile.tsx` and the manual test pass (spec's "Testing" section). No spec section is without a task.
- **Type consistency:** `FriendVisibilityEntry` (Task 2) fields `id`/`name`/`imageUri`/`canIntroduce`/`createdAt`/`isNew` are consumed by exact same names in Task 4's `listItems` mapping and `friendCaption(f.createdAt, f.isNew)`. `FriendVisibilityList`'s widened `friends` prop (Task 3: `{ id, name, isNew?, caption? }`) matches exactly what Task 4's `listItems` produces. `setFriendCanIntroduce(userId, friendId, canIntroduce)` and `setAllFriendsCanIntroduce(userId, friendIds, canIntroduce)` signatures (Task 2) match their call sites in Task 4 exactly (positional args, same order).
- **No placeholders:** all steps show complete code; no TBD/TODO-as-instruction; no "similar to Task N" shortcuts — Task 3's onboarding-file edits are shown as full before/after blocks rather than described.
