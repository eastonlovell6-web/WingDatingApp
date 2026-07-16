# Invite Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the Home screen's currently-inert Invite button to a real Invite page that generates 5 personal invite codes per user, lets them share each via the native share sheet, and tracks which codes have been sent.

**Architecture:** A new `invites` Supabase table (5 rows per user, lazily seeded on first visit) backs a new `lib/invites.ts` data layer, a new `app/(tabs)/invite.tsx` screen (registered `href: null`, same pattern as `discover.tsx`), and a new `components/invite/InviteCodeRow.tsx` row component. The Home screen's two existing `onInvitePress` stubs (`HomeHeader`, `IntroFeed`) get wired to `router.push("/invite")`.

**Tech Stack:** Expo Router, Supabase (`@supabase/supabase-js`), TanStack React Query, React Native's built-in `Share` API (no new dependency), TypeScript strict mode.

## Global Constraints

- No migrations folder — schema changes are hand-applied via the Supabase SQL Editor, one script at a time (see `supabase/sql/00N_*.sql` convention).
- No test runner exists in this repo (zero `*.test.*` files across the whole history) — verification is `npm run typecheck`, `npm run lint`, and a manual walkthrough, not automated unit tests.
- Design tokens only from `constants/colors.ts`, `constants/spacing.ts`, `constants/typography.ts` — no ad hoc hex/px values.
- `lib/*.ts` functions throw on Supabase errors; no new error-handling pattern.
- Out of scope: onboarding/signup does NOT check invite codes — `status` on an invite row means "share sheet fired for this code," not "redeemed." `matchmaker/select.tsx`'s separate Invite stub is untouched.
- Keep files under 500 lines.

---

### Task 1: `invites` table + RLS

**Files:**
- Create: `supabase/sql/007_invites_schema.sql`

**Interfaces:**
- Produces: an `invites` table with columns `id uuid`, `owner_id uuid`, `code text unique`, `status text` (`'unsent'|'sent'`), `created_at timestamptz`, `sent_at timestamptz`. RLS: a user may select/insert/update only rows where `owner_id = auth.uid()`.

- [ ] **Step 1: Write the schema file**

```sql
-- supabase/sql/007_invites_schema.sql
-- Hand-apply in the Supabase SQL Editor (see 001_notifications_schema.sql —
-- this project has no migrations folder; schema is applied by hand, one
-- script at a time, only when the current work needs it).
--
-- Backs the Home screen's Invite page. Each user gets 5 rows, lazily
-- seeded client-side by lib/invites.ts's getInviteSlots on first visit.
-- `status` only tracks whether the app has fired the native share sheet
-- for that code — onboarding does NOT check invite codes at signup, so
-- there is no real redemption to track yet (see
-- docs/superpowers/specs/2026-07-16-invite-page-design.md).

create table invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  status text not null default 'unsent' check (status in ('unsent', 'sent')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table invites enable row level security;

create policy "invites_select_own" on invites for select using (auth.uid() = owner_id);
create policy "invites_insert_own" on invites for insert with check (auth.uid() = owner_id);
create policy "invites_update_own" on invites for update using (auth.uid() = owner_id);
```

- [ ] **Step 2: Apply it in the Supabase SQL Editor**

Open the linked Supabase project's SQL Editor, paste the contents of
`supabase/sql/007_invites_schema.sql`, and run it. Confirm in the Table
Editor that `invites` now exists with RLS enabled and 3 policies.

- [ ] **Step 3: Commit**

```bash
git add supabase/sql/007_invites_schema.sql
git commit -m "feat: add invites table schema for the Home invite page"
```

---

### Task 2: `lib/invites.ts` data layer

**Files:**
- Create: `lib/invites.ts`

**Interfaces:**
- Consumes: `supabase` client from `lib/supabase.ts` (`import { supabase } from "./supabase"`).
- Produces:
  - `interface InviteSlot { id: string; code: string; status: "unsent" | "sent"; }`
  - `getInviteSlots(userId: string): Promise<InviteSlot[]>`
  - `markInviteSent(inviteId: string): Promise<void>`

- [ ] **Step 1: Write `lib/invites.ts`**

```ts
import { supabase } from "./supabase";

export interface InviteSlot {
  id: string;
  code: string;
  status: "unsent" | "sent";
}

const SLOT_COUNT = 5;
// Excludes 0/O/1/I to avoid ambiguous codes when read aloud or handwritten.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateInviteCode(): string {
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `WING-${suffix}`;
}

// Postgres unique_violation — retry with a freshly generated code rather
// than failing the whole seed pass.
async function insertInviteWithRetry(userId: string, attempt = 0): Promise<void> {
  const { error } = await supabase
    .from("invites")
    .insert({ owner_id: userId, code: generateInviteCode() });
  if (error) {
    if (error.code === "23505" && attempt < 5) {
      return insertInviteWithRetry(userId, attempt + 1);
    }
    throw error;
  }
}

async function seedInviteSlots(userId: string): Promise<void> {
  for (let i = 0; i < SLOT_COUNT; i++) {
    await insertInviteWithRetry(userId);
  }
}

/**
 * A user's 5 invite slots, seeded on first call. Each row's `status` tracks
 * only whether the share sheet has fired for that code — not redemption
 * (onboarding doesn't check invite codes yet).
 */
export async function getInviteSlots(userId: string): Promise<InviteSlot[]> {
  const { data: existing, error: selectError } = await supabase
    .from("invites")
    .select("id, code, status")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });
  if (selectError) throw selectError;
  if (existing && existing.length > 0) return existing;

  await seedInviteSlots(userId);

  const { data: seeded, error: reselectError } = await supabase
    .from("invites")
    .select("id, code, status")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });
  if (reselectError) throw reselectError;
  return seeded ?? [];
}

export async function markInviteSent(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from("invites")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", inviteId);
  if (error) throw error;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors from `lib/invites.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/invites.ts
git commit -m "feat: add lib/invites.ts data layer for invite slots"
```

---

### Task 3: `InviteCodeRow` component

**Files:**
- Create: `components/invite/InviteCodeRow.tsx`

**Interfaces:**
- Consumes: `Button` (`components/ui/Button.tsx`, props `title`, `variant`, `onPress`, `style`), `Badge` (`components/ui/Badge.tsx`, props `label`, `tone`, `variant`, `textColor`), design tokens from `constants/colors.ts` (`ink`, `shadowTint`, `surface`), `constants/spacing.ts` (`radii`, `spacing`), `constants/typography.ts` (`fonts`, `fontSize`).
- Produces: `InviteCodeRow` component, props `{ code: string; status: "unsent" | "sent"; onShare: () => void }`.

- [ ] **Step 1: Write `components/invite/InviteCodeRow.tsx`**

```tsx
import { Text, View } from "react-native";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { ink, shadowTint, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";

interface InviteCodeRowProps {
  code: string;
  status: "unsent" | "sent";
  onShare: () => void;
}

export function InviteCodeRow({ code, status, onShare }: InviteCodeRowProps) {
  const isSent = status === "sent";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: surface.paper,
        borderRadius: radii.md,
        padding: spacing[4],
        shadowColor: shadowTint,
        shadowOpacity: 1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: fontSize.base[0],
          lineHeight: fontSize.base[1],
          color: ink[900],
        }}
      >
        {code}
      </Text>

      {isSent ? (
        <Badge label="Sent" tone="plum" variant="outline" textColor={ink[500]} />
      ) : (
        <Button
          title="Share"
          variant="outline"
          onPress={onShare}
          style={{ height: 44, paddingHorizontal: 20 }}
        />
      )}
    </View>
  );
}

export default InviteCodeRow;
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors from `components/invite/InviteCodeRow.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/invite/InviteCodeRow.tsx
git commit -m "feat: add InviteCodeRow component"
```

---

### Task 4: Invite screen + tab registration

**Files:**
- Create: `app/(tabs)/invite.tsx`
- Modify: `app/(tabs)/_layout.tsx`

**Interfaces:**
- Consumes: `getInviteSlots`, `markInviteSent`, `InviteSlot` from `lib/invites.ts` (Task 2); `InviteCodeRow` from `components/invite/InviteCodeRow.tsx` (Task 3); `useAuthStore` from `store/auth.ts` (`useAuthStore((s) => s.user?.id)`, same pattern as `app/(tabs)/discover.tsx`).
- Produces: route `/invite`, pushed via `router.push("/invite")`.

- [ ] **Step 1: Write `app/(tabs)/invite.tsx`**

```tsx
import { Pressable, ScrollView, Share, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { InviteCodeRow } from "../../components/invite/InviteCodeRow";
import { getInviteSlots, markInviteSent, type InviteSlot } from "../../lib/invites";
import { useAuthStore } from "../../store/auth";
import { ink, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5 8 12l7 7" stroke={ink[900]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function InviteScreen() {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const queryKey = ["inviteSlots", userId];

  const { data: slots = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => getInviteSlots(userId!),
    enabled: !!userId,
  });

  const remaining = slots.filter((slot) => slot.status === "unsent").length;

  async function handleShare(slot: InviteSlot) {
    try {
      // Android's Share.share() always resolves with sharedAction —
      // dismissedAction only ever fires on iOS.
      const result = await Share.share({
        message: `Join me on Wing — use my invite code: ${slot.code}`,
      });
      if (result.action === Share.sharedAction) {
        await markInviteSent(slot.id);
        queryClient.invalidateQueries({ queryKey });
      }
    } catch (err) {
      console.warn("Invite share failed", err);
    }
  }

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

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing[6],
          paddingTop: spacing[2],
          paddingBottom: insets.bottom + spacing[8],
          gap: spacing[6],
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: spacing[2] }}>
          <Text
            style={{
              fontFamily: fonts.displaySemibold,
              fontSize: fontSize["2xl"][0],
              lineHeight: fontSize["2xl"][1],
              color: ink[900],
            }}
          >
            Invite Friends
          </Text>
          <Text style={{ fontFamily: fonts.body, fontSize: fontSize.base[0], color: ink[500] }}>
            {remaining > 0 ? `You have ${remaining} of 5 invites left` : "All invites sent"}
          </Text>
        </View>

        {isLoading ? (
          <Text style={{ fontFamily: fonts.body, fontSize: fontSize.base[0], color: ink[500] }}>
            Loading...
          </Text>
        ) : (
          <View style={{ gap: spacing[2] }}>
            {slots.map((slot) => (
              <InviteCodeRow
                key={slot.id}
                code={slot.code}
                status={slot.status}
                onShare={() => handleShare(slot)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 2: Register the route with `href: null` in `app/(tabs)/_layout.tsx`**

Current file:

```tsx
import { Tabs } from "expo-router";
import { TabBar } from "../../components/home/TabBar";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="intros" />
      <Tabs.Screen name="chats" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="discover" options={{ href: null }} />
    </Tabs>
  );
}
```

Change the last line to add the `invite` screen:

```tsx
      <Tabs.Screen name="discover" options={{ href: null }} />
      <Tabs.Screen name="invite" options={{ href: null }} />
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors from `app/(tabs)/invite.tsx` or `app/(tabs)/_layout.tsx`.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/invite.tsx" "app/(tabs)/_layout.tsx"
git commit -m "feat: add Invite screen"
```

---

### Task 5: Wire Home screen's Invite entry points

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `router` from `expo-router` (already imported in this file); no new exports.

- [ ] **Step 1: Add `onInvitePress` to `HomeHeader`**

In `app/(tabs)/index.tsx`, find:

```tsx
        <HomeHeader
          name={name}
          loading={!!userId && isLoading}
          subhead={introSubhead}
          onDiscoverPress={() => router.push("/discover" as never)}
        />
```

Replace with:

```tsx
        <HomeHeader
          name={name}
          loading={!!userId && isLoading}
          subhead={introSubhead}
          onDiscoverPress={() => router.push("/discover" as never)}
          onInvitePress={() => router.push("/invite" as never)}
        />
```

- [ ] **Step 2: Add `onInvitePress` to `IntroFeed`**

In the same file, find:

```tsx
        {isWingman ? (
          <PromptCard prompt={getTodaysPrompt()} introducibleCount={(introducibleFriends ?? []).length} />
        ) : (
          <IntroFeed intros={intros ?? []} />
        )}
```

Replace with:

```tsx
        {isWingman ? (
          <PromptCard prompt={getTodaysPrompt()} introducibleCount={(introducibleFriends ?? []).length} />
        ) : (
          <IntroFeed intros={intros ?? []} onInvitePress={() => router.push("/invite" as never)} />
        )}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual walkthrough**

Start the app (`npm run web` or `npm run ios`/`android` per your environment). Sign in, land on Home:
1. Tap the "Invite" button in the header → Invite Friends screen opens, showing "You have 5 of 5 invites left" and 5 rows with distinct `WING-XXXX` codes.
2. Tap "Share" on one row → OS share sheet opens with the "Join me on Wing…" message.
3. Complete (don't cancel) the share → back on the Invite screen, that row now shows a "Sent" badge instead of a Share button, and the subhead reads "You have 4 of 5 invites left".
4. Navigate back to Home, tap Invite again → the same "Sent" row persists (confirms it's backed by the `invites` table, not local-only state).
5. If your test account has zero incoming intros, also confirm the empty-state "Invite friends" button on the Home feed opens the same screen.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/index.tsx"
git commit -m "feat: wire Home screen Invite button to the Invite page"
```
