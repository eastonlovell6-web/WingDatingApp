# Waiting on Them Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give recipients a persistent "waiting on them" status on Home for
intros they've already accepted, auto-expire stale intros after 7 days, and
push both matched participants (not just the matchmaker) when a chat
unlocks.

**Architecture:** A new `expired` status on `introductions` plus a daily
Edge Function sweep (Task 1-2). A new read query mirroring the existing
`getIncomingIntroductions` pattern, surfaced as a new Home section (Task
3-5). A push-notification fix in `respond-to-introduction` plus the
client-side routing to receive it (Task 6-7). A reused confirmation overlay
after tapping Accept (Task 8).

**Tech Stack:** Expo Router (React Native/TypeScript), Supabase (Postgres +
Edge Functions/Deno), TanStack Query, Zustand.

**Spec:** `docs/superpowers/specs/2026-07-22-waiting-on-them-design.md`

## Global Constraints

- 7-day expiry window, anchored on `introductions.created_at` (same clock
  the "waiting X days" label uses).
- Expiry is silent — no push, no matchmaker visibility, matching the
  existing silent-pass convention.
- Matchmaker firewall stays intact — matchmaker-facing queries never see
  intro status beyond aggregate pending/matched.
- Push copy always names the matchmaker by first name, never generic
  "someone"/"a friend" language (see `_shared/notificationCopy.ts`'s header
  comment).
- No automated test framework exists in this repo (no jest/vitest, no
  `*.test.ts` files) — every prior feature in this codebase verifies via
  `npm run typecheck` plus manual verification through Expo. This plan
  follows that same convention rather than introducing a new one.

---

### Task 1: Add `expired` status to `introductions`

**Files:**
- Create: `supabase/sql/010_introductions_expired_status.sql`

**Interfaces:**
- Produces: `introductions.status` now accepts `'expired'` alongside the
  existing `'both_pending' | 'pending_a' | 'pending_b' | 'accepted' |
  'passed' | 'withdrawn'`.

- [ ] **Step 1: Look up the actual check constraint name**

Run this in the Supabase SQL editor (or `psql`) against the project
database:
```sql
select conname from pg_constraint
where conrelid = 'introductions'::regclass and contype = 'c';
```
Expected: one row, a name like `introductions_status_check` (confirm the
exact string — `003_introductions_withdrawn_status.sql` assumed this name
but it was never independently verified).

- [ ] **Step 2: Write the migration using the confirmed name**

```sql
-- supabase/sql/010_introductions_expired_status.sql
-- Substitute <actual_constraint_name> with the name found in Step 1.
alter table introductions drop constraint <actual_constraint_name>;
alter table introductions add constraint introductions_status_check
  check (status in ('both_pending', 'pending_a', 'pending_b', 'accepted',
                     'passed', 'withdrawn', 'expired'));
```

- [ ] **Step 3: Run the migration**

Run the file's contents in the Supabase SQL editor.
Expected: `ALTER TABLE` succeeds with no error, twice (drop, then add).

- [ ] **Step 4: Verify the new value is accepted**

```sql
begin;
update introductions set status = 'expired' where false; -- no-op, just checks the constraint accepts the value
rollback;
```
Expected: no constraint violation error. (The `where false` means nothing
is actually updated — this only proves Postgres accepts `'expired'` as a
valid value for the column.)

- [ ] **Step 5: Commit**

```bash
git add supabase/sql/010_introductions_expired_status.sql
git commit -m "feat: add expired status to introductions"
```

---

### Task 2: Build and schedule the expiry sweep

**Files:**
- Create: `supabase/functions/expire-introductions/index.ts`

**Interfaces:**
- Consumes: `createAdminClient()` from `supabase/functions/_shared/adminClient.ts`
  (existing, unchanged).
- Produces: an HTTP endpoint that, when called, expires stale
  introductions. No client-side caller — invoked only by a scheduled Cron
  Job (Step 3).

- [ ] **Step 1: Write the function**

```ts
// supabase/functions/expire-introductions/index.ts
import { createAdminClient } from "../_shared/adminClient.ts";

// Invoked by a Supabase Dashboard Cron Job (Project > Integrations > Cron
// Jobs), not by a signed-in user — unlike every other function here, there's
// no getCallerId/UnauthorizedError because there's no acting user. The
// platform's own JWT verification (enabled by default) is satisfied by the
// Cron Job passing the project's service role key as its Authorization
// bearer token; only whoever holds that key can trigger this, the same
// trust level createAdminClient() already assumes everywhere else.
Deno.serve(async (_req: Request) => {
  try {
    const admin = createAdminClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await admin
      .from("introductions")
      .update({ status: "expired" })
      .in("status", ["both_pending", "pending_a", "pending_b"])
      .lt("created_at", sevenDaysAgo)
      .select("id");

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ expired: data?.length ?? 0 }), { status: 200 });
  } catch (err) {
    console.warn("expire-introductions: unexpected error", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
});
```

- [ ] **Step 2: Deploy the function**

```bash
supabase functions deploy expire-introductions
```
Expected: CLI reports a successful deploy and prints the function's URL
(`https://<project-ref>.supabase.co/functions/v1/expire-introductions`).

- [ ] **Step 3: Verify it runs, with no rows old enough yet**

```bash
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/expire-introductions" \
  -H "Authorization: Bearer <service-role-key>"
```
Expected: `200` with body `{"expired":0}` (no real introduction is 7 days
old yet at this point in the build).

- [ ] **Step 4: Verify it actually expires a stale row**

In the SQL editor, backdate one test introduction (use a real row's id from
your test data, one that's currently `both_pending`/`pending_a`/`pending_b`):
```sql
update introductions set created_at = now() - interval '8 days'
where id = '<test-intro-id>';
```
Re-run the `curl` command from Step 3.
Expected: `200` with body `{"expired":1}`. Then confirm in the SQL editor:
```sql
select status from introductions where id = '<test-intro-id>';
```
Expected: `expired`.

- [ ] **Step 5: Schedule the daily sweep**

In the Supabase Dashboard: Project → Integrations → Cron Jobs → Create a
new cron job.
- Type: HTTP Request
- URL: the function URL from Step 2
- Method: POST
- Headers: `Authorization: Bearer <service-role-key>`
- Schedule: `0 6 * * *` (daily, 06:00 UTC)

Expected: the job appears in the Cron Jobs list as active. Trigger it once
manually from the dashboard's "Run now" action and confirm it returns 200
in the job's run history.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/expire-introductions/index.ts
git commit -m "feat: add expire-introductions edge function and daily sweep"
```

---

### Task 3: Add the "waiting on them" query

**Files:**
- Modify: `components/intro/mockIntros.ts`
- Modify: `lib/introductions.ts`

**Interfaces:**
- Consumes: `supabase` client from `./supabase` (existing import in
  `lib/introductions.ts`, unchanged).
- Produces: `WaitingIntro` type (exported from `components/intro/mockIntros.ts`)
  and `getWaitingOnThemIntroductions(userId: string): Promise<WaitingIntro[]>`
  (exported from `lib/introductions.ts`) — both consumed by Task 4/5.

- [ ] **Step 1: Add the `WaitingIntro` type**

Append to `components/intro/mockIntros.ts` (after the existing
`IntroDetail` interface):
```ts
// Recipient-facing status card for an intro you've already accepted but the
// other person hasn't answered yet. Real data comes from
// lib/introductions.ts's getWaitingOnThemIntroductions.
export interface WaitingIntro {
  id: string;
  matchmakerName: string;
  matchmakerAvatarUri?: string;
  matchAvatarName: string;
  matchAvatarUri?: string;
  createdAt: string;
}
```

- [ ] **Step 2: Add the fetch + mapping functions**

Append to `lib/introductions.ts` (after the existing
`getIncomingIntroductions` function), and add `WaitingIntro` to the
existing `mockIntros` import at the top of the file:
```ts
import type { IntroPreview, IntroDetail, WaitingIntro } from "../components/intro/mockIntros";
```
```ts
// Mirrors fetchIncomingIntroRows below, but with the complementary status
// filter: 'pending_b' means user_a already accepted and user_b is the one
// still pending (and vice versa for 'pending_a') — see
// respond-to-introduction/index.ts's status-transition logic.
async function fetchWaitingOnThemRows(userId: string) {
  const [asA, asB] = await Promise.all([
    supabase
      .from("introductions")
      .select("id, matchmaker_id, user_b_id, created_at")
      .eq("user_a_id", userId)
      .eq("status", "pending_b"),
    supabase
      .from("introductions")
      .select("id, matchmaker_id, user_a_id, created_at")
      .eq("user_b_id", userId)
      .eq("status", "pending_a"),
  ]);
  if (asA.error) throw asA.error;
  if (asB.error) throw asB.error;

  return [
    ...(asA.data ?? []).map((row) => ({ ...row, otherUserId: row.user_b_id })),
    ...(asB.data ?? []).map((row) => ({ ...row, otherUserId: row.user_a_id })),
  ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function getWaitingOnThemIntroductions(userId: string): Promise<WaitingIntro[]> {
  const rows = await fetchWaitingOnThemRows(userId);

  const userIds = Array.from(new Set(rows.flatMap((r) => [r.matchmaker_id, r.otherUserId])));
  const { data: users, error: usersError } =
    userIds.length > 0
      ? await supabase.from("users").select("id, name, photos").in("id", userIds)
      : { data: [], error: null };
  if (usersError) throw usersError;
  const userById = new Map((users ?? []).map((u) => [u.id, u]));

  return rows.map((row) => {
    const matchmaker = userById.get(row.matchmaker_id);
    const other = userById.get(row.otherUserId);
    return {
      id: row.id,
      matchmakerName: (matchmaker?.name ?? "Someone").split(" ")[0],
      matchmakerAvatarUri: matchmaker?.photos?.[0] ?? undefined,
      matchAvatarName: other?.name ?? "Someone",
      matchAvatarUri: other?.photos?.[0] ?? undefined,
      createdAt: row.created_at,
    };
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual verification against real data**

Using the test intro id from Task 2 Step 4 (before you ran the expiry sweep
on it — if you already expired it, pick/create a fresh `pending_a` or
`pending_b` row), add a temporary console.log call in a scratch script or
the React Native debugger to call
`getWaitingOnThemIntroductions('<the-accepting-users-id>')` and confirm it
returns one row with the expected `matchAvatarName` and `createdAt`.

- [ ] **Step 5: Commit**

```bash
git add components/intro/mockIntros.ts lib/introductions.ts
git commit -m "feat: add getWaitingOnThemIntroductions"
```

---

### Task 4: Build the waiting-intro card and section components

**Files:**
- Create: `components/intro/WaitingIntroCard.tsx`
- Create: `components/home/WaitingOnThemSection.tsx`

**Interfaces:**
- Consumes: `WaitingIntro` type (Task 3), `Avatar`/`Badge` from
  `components/ui/`, `elevation` from `constants/elevation.ts`.
- Produces: `WaitingOnThemSection` component, consumed by Task 5.

- [ ] **Step 1: Write `WaitingIntroCard`**

```tsx
// components/intro/WaitingIntroCard.tsx
import { Text, View } from "react-native";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { ink, plum, surface } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { radii, spacing } from "../../constants/spacing";
import { elevation } from "../../constants/elevation";
import type { WaitingIntro } from "./mockIntros";

interface WaitingIntroCardProps {
  intro: WaitingIntro;
}

function formatWaitingLabel(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export function WaitingIntroCard({ intro }: WaitingIntroCardProps) {
  const waitingLabel = formatWaitingLabel(intro.createdAt);

  return (
    <View
      accessible
      accessibilityLabel={`Waiting on ${intro.matchAvatarName}, ${intro.matchmakerName}'s intro, ${waitingLabel}`}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing[4],
          backgroundColor: surface.paper,
          borderRadius: radii.md,
          padding: spacing[4],
        },
        elevation.xs,
      ]}
    >
      <View style={{ borderRadius: radii.pill, borderWidth: 1.5, borderColor: plum[100], padding: 2 }}>
        <Avatar name={intro.matchAvatarName} size={40} imageUri={intro.matchAvatarUri} />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{ fontFamily: fonts.bodyMedium, fontSize: fontSize.base[0], color: ink[900] }}
          numberOfLines={1}
        >
          Waiting on {intro.matchAvatarName}
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: fontSize.sm[0], color: ink[500] }}>
          {intro.matchmakerName}&rsquo;s intro &middot; {waitingLabel}
        </Text>
      </View>

      <Badge label="Pending" tone="butter" variant="outline" textColor={ink[900]} />
    </View>
  );
}

export default WaitingIntroCard;
```

- [ ] **Step 2: Write `WaitingOnThemSection`**

```tsx
// components/home/WaitingOnThemSection.tsx
import { Text, View } from "react-native";
import { WaitingIntroCard } from "../intro/WaitingIntroCard";
import type { WaitingIntro } from "../intro/mockIntros";
import { coral } from "../../constants/colors";
import { fonts, fontSize } from "../../constants/typography";
import { spacing } from "../../constants/spacing";

interface WaitingOnThemSectionProps {
  waiting: WaitingIntro[];
}

export function WaitingOnThemSection({ waiting }: WaitingOnThemSectionProps) {
  if (waiting.length === 0) return null;

  return (
    <View style={{ gap: spacing[4] }}>
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: fontSize.xs[0],
          letterSpacing: 1,
          textTransform: "uppercase",
          color: coral[500],
        }}
      >
        Waiting on them
      </Text>
      <View style={{ gap: spacing[2] }}>
        {waiting.map((intro) => (
          <WaitingIntroCard key={intro.id} intro={intro} />
        ))}
      </View>
    </View>
  );
}

export default WaitingOnThemSection;
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/intro/WaitingIntroCard.tsx components/home/WaitingOnThemSection.tsx
git commit -m "feat: add WaitingIntroCard and WaitingOnThemSection components"
```

---

### Task 5: Wire the section into Home

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `getWaitingOnThemIntroductions` (Task 3),
  `WaitingOnThemSection` (Task 4).
- Produces: TanStack Query key `["waitingOnThemIntros", userId]` — Task 8
  invalidates this same key after a successful accept.

- [ ] **Step 1: Update imports**

In `app/(tabs)/index.tsx`, change:
```tsx
import { getIncomingIntroductions } from "../../lib/introductions";
```
to:
```tsx
import { getIncomingIntroductions, getWaitingOnThemIntroductions } from "../../lib/introductions";
```
and add, alongside the other component imports:
```tsx
import { WaitingOnThemSection } from "../../components/home/WaitingOnThemSection";
```

- [ ] **Step 2: Add the query**

After the existing `intros` query (the one calling
`getIncomingIntroductions`), add:
```tsx
  const { data: waitingOn } = useQuery({
    queryKey: ["waitingOnThemIntros", userId],
    queryFn: () => getWaitingOnThemIntroductions(userId!),
    enabled: !!userId,
  });
```

- [ ] **Step 3: Render the section**

Change:
```tsx
        {isWingman ? (
          <PromptCard prompt={getTodaysPrompt()} introducibleCount={(introducibleFriends ?? []).length} />
        ) : (
          <IntroFeed intros={intros ?? []} onInvitePress={() => router.push("/invite" as never)} />
        )}
        {isWingman ? (
          <WingCardStack friends={friends ?? []} />
        ) : (
          <FriendsRow friends={friends ?? []} />
        )}
```
to:
```tsx
        {isWingman ? (
          <PromptCard prompt={getTodaysPrompt()} introducibleCount={(introducibleFriends ?? []).length} />
        ) : (
          <IntroFeed intros={intros ?? []} onInvitePress={() => router.push("/invite" as never)} />
        )}
        <WaitingOnThemSection waiting={waitingOn ?? []} />
        {isWingman ? (
          <WingCardStack friends={friends ?? []} />
        ) : (
          <FriendsRow friends={friends ?? []} />
        )}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Open the app on the account you accepted an intro on earlier (Task 3 Step
4's test data — re-create a fresh `pending_a`/`pending_b` row if it already
expired). Confirm the "Waiting on them" section renders below the intros
feed with the right name and day count, and that it renders nothing when
there's no such row (log out / switch to an account with none).

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/index.tsx"
git commit -m "feat: show Waiting on them section on Home"
```

---

### Task 6: Push both participants on match

**Files:**
- Modify: `supabase/functions/_shared/notificationCopy.ts`
- Modify: `supabase/functions/respond-to-introduction/index.ts`

**Interfaces:**
- Produces: `formatIntroMatchedNotification(matchmakerFirstName: string)`,
  and a new push `data` payload shape `{ type: "intro_matched", introId:
  string }` sent to both `user_a_id` and `user_b_id` — consumed client-side
  by Task 7.

- [ ] **Step 1: Add the copy function**

Append to `supabase/functions/_shared/notificationCopy.ts`:
```ts
export function formatIntroMatchedNotification(matchmakerFirstName: string) {
  return {
    title: "You're in!",
    body: `${matchmakerFirstName} introduced you two, and you're both in — say hi`,
  };
}
```

- [ ] **Step 2: Update the import in `respond-to-introduction/index.ts`**

Change:
```ts
import { formatIntroAcceptedNotification } from "../_shared/notificationCopy.ts";
```
to:
```ts
import { formatIntroAcceptedNotification, formatIntroMatchedNotification } from "../_shared/notificationCopy.ts";
```

- [ ] **Step 3: Fetch the matchmaker's name and push both participants**

Replace the `if (newStatus === "accepted") { ... }` block (currently lines
98-121) with:
```ts
    if (newStatus === "accepted") {
      // Chat creation must never turn a successful accept into a failure
      // response — respondToIntroduction's client retry only handles a
      // 409 conflict, and a second call after this point reads
      // status === "accepted" and 409s with "already resolved," which
      // isn't a conflict the retry logic knows how to resolve. A rare
      // insert failure here becomes a to-be-healed-manually gap, not a
      // stuck user. chats.intro_id is unique (005_chats_realtime.sql), so
      // a retried insert can never produce a duplicate chat.
      const { error: chatError } = await admin.from("chats").insert({ intro_id: introId });
      if (chatError) {
        console.warn("respond-to-introduction: chat creation failed", chatError);
      }

      const { title, body } = formatIntroAcceptedNotification();

      // Both matched participants need their own push too — the
      // matchmaker-facing one above never reaches them, and they're the
      // ones who now have a chat to open. Needs the matchmaker's first
      // name, which isn't in the `intro` select above (that query only
      // needed ids/status for the status-transition logic) — same lookup
      // pattern as nudge-introduction/index.ts.
      const { data: matchmaker } = await admin
        .from("users")
        .select("name")
        .eq("id", intro.matchmaker_id)
        .maybeSingle();
      const matchmakerFirstName = (matchmaker?.name ?? "Someone").split(" ")[0];
      const { title: matchedTitle, body: matchedBody } = formatIntroMatchedNotification(matchmakerFirstName);

      // The status is already committed at this point — push delivery is
      // best-effort and must never turn a successful status update into a
      // failure response.
      try {
        await Promise.all([
          sendPushToUser(admin, intro.matchmaker_id, title, body, { type: "intro_accepted" }),
          sendPushToUser(admin, intro.user_a_id, matchedTitle, matchedBody, { type: "intro_matched", introId }),
          sendPushToUser(admin, intro.user_b_id, matchedTitle, matchedBody, { type: "intro_matched", introId }),
        ]);
      } catch (pushError) {
        console.warn("respond-to-introduction: push delivery failed", pushError);
      }
    }
```

- [ ] **Step 4: Deploy**

```bash
supabase functions deploy respond-to-introduction
```
Expected: CLI reports a successful deploy.

- [ ] **Step 5: Manual verification**

Using two test accounts with push tokens registered
(`registerForPushNotificationsAsync` must have run on each device/simulator
that supports it), walk one introduction through `both_pending` → one
accepts → the other accepts. Confirm: the matchmaker's device gets the
existing "Your intro was accepted by both" push, and both participant
devices get the new "You're in!" push naming the matchmaker.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/notificationCopy.ts supabase/functions/respond-to-introduction/index.ts
git commit -m "feat: push both participants when an intro matches"
```

---

### Task 7: Route the new push to Chats on tap

**Files:**
- Modify: `lib/notifications.ts`

**Interfaces:**
- Consumes: the `{ type: "intro_matched", introId }` payload shape (Task 6).
- Produces: `WingNotificationData` includes `intro_matched`;
  `routeForNotificationData` routes it to `/(tabs)/chats`.

- [ ] **Step 1: Extend the data type**

Change:
```ts
export type WingNotificationData =
  | { type: "intro"; introId: string }
  | { type: "intro_accepted" }
  | { type: "message"; chatId: string }
  | { type: "intro_request" };
```
to:
```ts
export type WingNotificationData =
  | { type: "intro"; introId: string }
  | { type: "intro_accepted" }
  | { type: "intro_matched"; introId: string }
  | { type: "message"; chatId: string }
  | { type: "intro_request" };
```

- [ ] **Step 2: Add the routing case**

Change:
```ts
export function routeForNotificationData(data: WingNotificationData): string | null {
  switch (data.type) {
    case "intro":
      return `/intro/${data.introId}`;
    case "message":
      return `/chat/${data.chatId}`;
    case "intro_accepted":
      return "/(tabs)/intros";
    case "intro_request":
      return "/(tabs)";
    default:
      return null;
  }
}
```
to:
```ts
export function routeForNotificationData(data: WingNotificationData): string | null {
  switch (data.type) {
    case "intro":
      return `/intro/${data.introId}`;
    case "message":
      return `/chat/${data.chatId}`;
    case "intro_accepted":
      return "/(tabs)/intros";
    case "intro_matched":
      return "/(tabs)/chats";
    case "intro_request":
      return "/(tabs)";
    default:
      return null;
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual verification**

From Task 6 Step 5's test, tap the "You're in!" push notification on a
device (or use `Notifications.getLastNotificationResponseAsync`'s cold-start
path by force-quitting and reopening after receiving it). Confirm it
navigates to the Chats tab.

- [ ] **Step 5: Commit**

```bash
git add lib/notifications.ts
git commit -m "feat: route intro_matched push taps to Chats"
```

---

### Task 8: Accept confirmation overlay

**Files:**
- Modify: `app/intro/[id].tsx`

**Interfaces:**
- Consumes: `SendConfirmationOverlay` from
  `components/matchmaker/SendConfirmationOverlay.tsx` (existing, its
  `message` prop is already generic — no changes to that component).
- Invalidates the `["waitingOnThemIntros", userId]` query key (Task 5) in
  addition to the existing `["incomingIntros", userId]`.

- [ ] **Step 1: Import the overlay**

Add to the imports in `app/intro/[id].tsx`:
```tsx
import { SendConfirmationOverlay } from "../../components/matchmaker/SendConfirmationOverlay";
```

- [ ] **Step 2: Add confirmation state**

Change:
```tsx
  const introId = intro?.id;
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
```
to:
```tsx
  const introId = intro?.id;
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
```

- [ ] **Step 3: Rename and extend the invalidation helper**

Change:
```tsx
  function invalidateIncomingIntros() {
    if (userId) queryClient.invalidateQueries({ queryKey: ["incomingIntros", userId] });
  }
```
to:
```tsx
  function invalidateIntroLists() {
    if (!userId) return;
    queryClient.invalidateQueries({ queryKey: ["incomingIntros", userId] });
    queryClient.invalidateQueries({ queryKey: ["waitingOnThemIntros", userId] });
  }
```
Update the other call site in `handleSkip`. Change:
```tsx
      respondToIntroduction(introId, "pass")
        .then(invalidateIncomingIntros)
        .catch((err) => console.warn("failed to record pass", err));
```
to:
```tsx
      respondToIntroduction(introId, "pass")
        .then(invalidateIntroLists)
        .catch((err) => console.warn("failed to record pass", err));
```
`handleAccept` (next step) is updated to call the new name directly.

- [ ] **Step 4: Update `handleAccept` to show the overlay instead of an immediate pop**

Change:
```tsx
  async function handleAccept() {
    if (!introId || accepting) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      await respondToIntroduction(introId, "accept");
      invalidateIncomingIntros();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      acceptScale.value = withSequence(withSpring(1.06, spring), withSpring(1, spring));
      setTimeout(() => {
        if (router.canGoBack()) router.back();
      }, 180);
    } catch (err) {
      setAccepting(false);
      setAcceptError(await extractFunctionErrorMessage(err, "Couldn't accept that intro. Try again."));
    }
  }
```
to:
```tsx
  async function handleAccept() {
    if (!introId || accepting) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      await respondToIntroduction(introId, "accept");
      invalidateIntroLists();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      acceptScale.value = withSequence(withSpring(1.06, spring), withSpring(1, spring));
      setConfirming(true);
    } catch (err) {
      setAccepting(false);
      setAcceptError(await extractFunctionErrorMessage(err, "Couldn't accept that intro. Try again."));
    }
  }

  function handleAcceptConfirmationDismiss() {
    setConfirming(false);
    if (router.canGoBack()) router.back();
  }
```

- [ ] **Step 5: Render the overlay**

Change the end of the component's return statement from:
```tsx
        </>
      )}
    </View>
  );
}
```
to:
```tsx
        </>
      )}
      <SendConfirmationOverlay
        visible={confirming}
        onDismiss={handleAcceptConfirmationDismiss}
        message="You're in — we'll let you know if they say yes too"
      />
    </View>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Manual verification**

Open a pending intro and tap "Accept intro." Confirm: the success haptic
and button scale animation still play, the confirmation overlay fades in
with the new copy, and after ~1.5s it fades out and navigates back to
Home — where the newly-accepted intro now appears under "Waiting on them"
(Task 5).

- [ ] **Step 8: Commit**

```bash
git add "app/intro/[id].tsx"
git commit -m "feat: show accept confirmation overlay before returning to Home"
```
