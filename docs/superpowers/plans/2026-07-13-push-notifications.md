# Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Wing's four push-notification triggers (intro sent, request-an-intro tapped, both-accept, new chat message) with the matchmaker firewall, silent-rejection, and no-read-receipt rules enforced server-side, not just in copy.

**Architecture:** Every state-changing action (send an intro, request an intro, accept/pass an intro, send a chat message) goes through a Supabase Edge Function running with the service-role key. Each function does the DB write *and* the Expo push send in one place, so the notification rule is enforced exactly where the data changes — not left to trust in the client. Row Level Security denies direct client writes to `introductions`, `intro_requests`, `chats`, and `messages`; the only table a client writes directly is `push_tokens` (its own row, for registration). This repo has no automated test runner (`package.json` has no jest/vitest), so verification steps use `npm run typecheck` plus exact manual SQL / curl recipes — matching the project's existing convention of hand-applying schema in the Supabase SQL Editor (see project memory: "no migrations folder").

**Tech Stack:** Expo Notifications (already installed, `expo-notifications` plugin already in `app.json`), Supabase Edge Functions (Deno), Supabase Postgres + RLS, `@supabase/supabase-js` (client and, via `npm:` specifier, inside Edge Functions).

## Global Constraints

- Exactly four triggers — no others: intro sent → both recipients; request-an-intro tapped → mutual friend; both-accept → matchmaker; new chat message → the other matched person.
- Passing/rejecting an intro triggers **zero** notifications to anyone, silently.
- The matchmaker receives **only** the both-accepted notification. Nothing tied to chat activity, read status, or anything else post-send.
- No `read_at` column or equivalent anywhere. The chat notification must fire unconditionally on every message insert — never gated on the recipient's foreground/app-open state, since that would make delivery itself an implicit read receipt.
- Chat notifications are scoped to only the two matched people. The matchmaker is never queried when sending a chat notification.
- No generic re-engagement / "come back" notifications — do not add one.
- Voice rule from `lib/notifications.ts`: always name the person, never generic language (e.g. not "New match found," not "You have a new message").
- This build does **not** add the Matchmaker Step 2 (send note) or Request-an-Intro screens — those haven't gone through this project's one-screen-at-a-time review yet. This plan builds the backend + a client service layer (`lib/introductions.ts`) that those screens will call once built, and wires the two triggers that already have real handlers today (`app/intro/[id].tsx` accept/skip, `app/chat/[id].tsx` send).
- No Supabase CLI or project credentials are available in the build environment. SQL and Edge Function source are written to disk for the user to apply by hand (SQL Editor) and deploy (`supabase functions deploy`) themselves — Task 13 gives the exact commands.
- `npm run typecheck` (`tsc --noEmit`) is the only automated check available in this repo — use it as the "test" step for every TypeScript task.

---

### Task 1: Database schema + RLS

**Files:**
- Create: `supabase/sql/001_notifications_schema.sql`

**Interfaces:**
- Produces: tables `introductions(id, matchmaker_id, user_a_id, user_b_id, note, status, created_at)`, `intro_requests(id, requester_id, target_id, mutual_friend_id, status, created_at)`, `chats(id, intro_id, created_at)`, `messages(id, chat_id, sender_id, content, created_at)` — no `read_at` column — and `push_tokens(user_id, expo_push_token, updated_at)`. `introductions.status` is one of `'both_pending' | 'pending_a' | 'pending_b' | 'accepted' | 'passed'`. Every later task's Edge Functions read/write these exact table and column names.

- [ ] **Step 1: Write the schema + RLS SQL**

```sql
-- supabase/sql/001_notifications_schema.sql
-- Hand-apply in the Supabase SQL Editor (this project has no migrations
-- folder — see project memory: schema is applied by hand, one script at a
-- time, only when the current work needs it).

create extension if not exists pgcrypto;

create table if not exists introductions (
  id uuid primary key default gen_random_uuid(),
  matchmaker_id uuid not null references auth.users(id),
  user_a_id uuid not null references auth.users(id),
  user_b_id uuid not null references auth.users(id),
  note text not null,
  status text not null default 'both_pending'
    check (status in ('both_pending', 'pending_a', 'pending_b', 'accepted', 'passed')),
  created_at timestamptz not null default now()
);

create table if not exists intro_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id),
  target_id uuid not null references auth.users(id),
  mutual_friend_id uuid not null references auth.users(id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now()
);

create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  intro_id uuid not null references introductions(id),
  created_at timestamptz not null default now()
);

-- No read_at column — ever. Wing has no read receipts anywhere.
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats(id),
  sender_id uuid not null references auth.users(id),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists push_tokens (
  user_id uuid primary key references auth.users(id),
  expo_push_token text not null,
  updated_at timestamptz not null default now()
);

alter table introductions enable row level security;
alter table intro_requests enable row level security;
alter table chats enable row level security;
alter table messages enable row level security;
alter table push_tokens enable row level security;

-- Read-only for participants. No insert/update policy on these four tables:
-- every write goes through the service-role Edge Functions (Tasks 3-6),
-- which are the only place the accept/pass state machine and the
-- matchmaker firewall are enforced.
create policy "introductions_select_participant" on introductions
  for select using (
    auth.uid() = matchmaker_id or auth.uid() = user_a_id or auth.uid() = user_b_id
  );

create policy "intro_requests_select_participant" on intro_requests
  for select using (
    auth.uid() = requester_id or auth.uid() = mutual_friend_id
  );

create policy "chats_select_participant" on chats
  for select using (
    exists (
      select 1 from introductions
      where introductions.id = chats.intro_id
        and (auth.uid() = introductions.user_a_id or auth.uid() = introductions.user_b_id)
    )
  );

create policy "messages_select_participant" on messages
  for select using (
    exists (
      select 1 from chats
      join introductions on introductions.id = chats.intro_id
      where chats.id = messages.chat_id
        and (auth.uid() = introductions.user_a_id or auth.uid() = introductions.user_b_id)
    )
  );

-- push_tokens is the one table a client writes directly — a user
-- registering their own device for push.
create policy "push_tokens_owner" on push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 2: Verify by hand in the Supabase SQL Editor**

After pasting and running the script above, run:

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('introductions', 'intro_requests', 'chats', 'messages', 'push_tokens')
order by table_name;
```

Expected: 5 rows — `chats`, `intro_requests`, `introductions`, `messages`, `push_tokens`.

```sql
select tablename, policyname from pg_policies where schemaname = 'public' order by tablename;
```

Expected: 5 rows, one policy per table (`chats_select_participant`, `intro_requests_select_participant`, `introductions_select_participant`, `messages_select_participant`, `push_tokens_owner`).

- [ ] **Step 3: Commit**

```bash
git add supabase/sql/001_notifications_schema.sql
git commit -m "feat: add notifications schema (introductions, intro_requests, chats, messages, push_tokens)"
```

---

### Task 2: Edge Function shared utilities

**Files:**
- Create: `supabase/functions/_shared/adminClient.ts`
- Create: `supabase/functions/_shared/verifyCaller.ts`
- Create: `supabase/functions/_shared/sendExpoPush.ts`
- Create: `supabase/functions/_shared/notificationCopy.ts`
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: `introductions`, `push_tokens` tables from Task 1.
- Produces: `createAdminClient(): SupabaseClient` (service-role client), `getCallerId(req: Request): Promise<string>` + `UnauthorizedError` (throws on missing/invalid bearer token, returns the verified `auth.uid()`), `sendPushToUser(admin, userId, title, body, data): Promise<void>`, and copy formatters `formatIntroNotification`, `formatIntroRequestNotification`, `formatIntroAcceptedNotification`, `formatMessageNotification` — all four Edge Function tasks (3-6) import from these files.

- [ ] **Step 1: Exclude Deno-runtime code from the app's TypeScript project**

Edge Functions run under Deno (global `Deno` object, `npm:` import specifiers) and are not part of the Expo/React Native TypeScript project — without this exclude, `tsc --noEmit` fails on every file under `supabase/functions/`.

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts",
    "nativewind-env.d.ts"
  ],
  "exclude": ["supabase/functions/**"]
}
```

- [ ] **Step 2: Write the admin client helper**

```typescript
// supabase/functions/_shared/adminClient.ts
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export function createAdminClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

- [ ] **Step 3: Write the caller-verification helper**

Never trust a client-supplied user id in the request body — every Edge Function derives the caller's identity from their verified JWT.

```typescript
// supabase/functions/_shared/verifyCaller.ts
import { createClient } from "npm:@supabase/supabase-js@2";

export class UnauthorizedError extends Error {}

export async function getCallerId(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    throw new UnauthorizedError("Missing bearer token");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    throw new UnauthorizedError("Invalid token");
  }
  return data.user.id;
}
```

- [ ] **Step 4: Write the Expo push sender**

```typescript
// supabase/functions/_shared/sendExpoPush.ts
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function sendPushToUser(
  admin: SupabaseClient,
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<void> {
  const { data: row } = await admin
    .from("push_tokens")
    .select("expo_push_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row?.expo_push_token) {
    return;
  }

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ to: row.expo_push_token, title, body, data }),
  });
}
```

- [ ] **Step 5: Write the notification copy formatters**

```typescript
// supabase/functions/_shared/notificationCopy.ts
// Mirrors the copy rules in lib/notifications.ts. Edge Functions deploy from
// only the supabase/functions/ directory, so this can't import across that
// boundary — keep these two files hand-synced. Wing always names the
// person; never generic "someone"/"a friend" language.

export function formatIntroNotification(matchmakerFirstName: string) {
  return {
    title: matchmakerFirstName,
    body: `${matchmakerFirstName} thinks you two should meet`,
  };
}

export function formatIntroRequestNotification(requesterFirstName: string) {
  return {
    title: requesterFirstName,
    body: `${requesterFirstName} wants you to introduce them`,
  };
}

export function formatIntroAcceptedNotification() {
  return {
    title: "Wing",
    body: "Your intro was accepted by both",
  };
}

export function formatMessageNotification(senderFirstName: string) {
  return {
    title: senderFirstName,
    body: `${senderFirstName} sent you a message`,
  };
}
```

- [ ] **Step 6: Verify the rest of the app still typechecks**

Run: `npm run typecheck`
Expected: no output, exit code 0 (the new `supabase/functions/**` files are now excluded, so Deno-only syntax doesn't break the app's typecheck).

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared tsconfig.json
git commit -m "feat: add shared Edge Function utilities for push notifications"
```

---

### Task 3: Edge Function — send-introduction

**Files:**
- Create: `supabase/functions/send-introduction/index.ts`

**Interfaces:**
- Consumes: `createAdminClient`, `getCallerId`, `UnauthorizedError` (Task 2 `verifyCaller.ts`), `sendPushToUser` (Task 2 `sendExpoPush.ts`), `formatIntroNotification` (Task 2 `notificationCopy.ts`).
- Produces: `POST /send-introduction` — body `{ userAId: string, userBId: string, note: string }`, caller identity (= `matchmaker_id`) taken from the JWT. Returns `{ introId: string }` on success. This is what `lib/introductions.ts#sendIntroduction` (Task 8) calls.

- [ ] **Step 1: Write the function**

```typescript
// supabase/functions/send-introduction/index.ts
import { createAdminClient } from "../_shared/adminClient.ts";
import { getCallerId, UnauthorizedError } from "../_shared/verifyCaller.ts";
import { sendPushToUser } from "../_shared/sendExpoPush.ts";
import { formatIntroNotification } from "../_shared/notificationCopy.ts";

Deno.serve(async (req: Request) => {
  try {
    const matchmakerId = await getCallerId(req);
    const { userAId, userBId, note } = await req.json();

    if (!userAId || !userBId || typeof note !== "string" || !note.trim()) {
      return new Response(
        JSON.stringify({ error: "userAId, userBId, and note are required" }),
        { status: 400 }
      );
    }
    if (userAId === userBId) {
      return new Response(
        JSON.stringify({ error: "userAId and userBId must be different" }),
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: intro, error: insertError } = await admin
      .from("introductions")
      .insert({
        matchmaker_id: matchmakerId,
        user_a_id: userAId,
        user_b_id: userBId,
        note: note.trim(),
        status: "both_pending",
      })
      .select("id")
      .single();

    if (insertError || !intro) {
      return new Response(JSON.stringify({ error: insertError?.message ?? "Insert failed" }), { status: 500 });
    }

    const { data: matchmaker } = await admin
      .from("users")
      .select("name")
      .eq("id", matchmakerId)
      .maybeSingle();
    const matchmakerFirstName = (matchmaker?.name ?? "Someone").split(" ")[0];
    const { title, body } = formatIntroNotification(matchmakerFirstName);

    // The introduction row is already committed at this point — push
    // delivery is best-effort and must never turn a successful write into a
    // failure response (a client retry on 500 would create a duplicate row).
    try {
      await Promise.all([
        sendPushToUser(admin, userAId, title, body, { type: "intro", introId: intro.id }),
        sendPushToUser(admin, userBId, title, body, { type: "intro", introId: intro.id }),
      ]);
    } catch (pushError) {
      console.warn("send-introduction: push delivery failed", pushError);
    }

    return new Response(JSON.stringify({ introId: intro.id }), { status: 200 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: err.message }), { status: 401 });
    }
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
});
```

- [ ] **Step 2: Verify the unauthenticated-request path by reading the code**

There's no Deno runtime in this environment to execute the function locally. Confirm by inspection: a request with no `Authorization` header reaches `getCallerId`, which throws `UnauthorizedError("Missing bearer token")` before any DB write or push send — so the 401 path never touches `introductions`. (Task 13 gives the exact `curl` command to confirm this against the deployed function once you've run `supabase functions deploy send-introduction`.)

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/send-introduction
git commit -m "feat: add send-introduction Edge Function"
```

---

### Task 4: Edge Function — request-introduction

**Files:**
- Create: `supabase/functions/request-introduction/index.ts`

**Interfaces:**
- Consumes: same Task 2 shared utilities as Task 3, plus `formatIntroRequestNotification`.
- Produces: `POST /request-introduction` — body `{ targetId: string, mutualFriendId: string }`, caller identity (= `requester_id`) from the JWT. Returns `{ requestId: string }`. Called by `lib/introductions.ts#requestIntroduction` (Task 8).

- [ ] **Step 1: Write the function**

```typescript
// supabase/functions/request-introduction/index.ts
import { createAdminClient } from "../_shared/adminClient.ts";
import { getCallerId, UnauthorizedError } from "../_shared/verifyCaller.ts";
import { sendPushToUser } from "../_shared/sendExpoPush.ts";
import { formatIntroRequestNotification } from "../_shared/notificationCopy.ts";

Deno.serve(async (req: Request) => {
  try {
    const requesterId = await getCallerId(req);
    const { targetId, mutualFriendId } = await req.json();

    if (!targetId || !mutualFriendId) {
      return new Response(
        JSON.stringify({ error: "targetId and mutualFriendId are required" }),
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: request, error: insertError } = await admin
      .from("intro_requests")
      .insert({
        requester_id: requesterId,
        target_id: targetId,
        mutual_friend_id: mutualFriendId,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !request) {
      return new Response(JSON.stringify({ error: insertError?.message ?? "Insert failed" }), { status: 500 });
    }

    const { data: requester } = await admin
      .from("users")
      .select("name")
      .eq("id", requesterId)
      .maybeSingle();
    const requesterFirstName = (requester?.name ?? "Someone").split(" ")[0];
    const { title, body } = formatIntroRequestNotification(requesterFirstName);

    // The intro_requests row is already committed at this point — push
    // delivery is best-effort and must never turn a successful write into a
    // failure response (a client retry on 500 would create a duplicate
    // request row).
    try {
      await sendPushToUser(admin, mutualFriendId, title, body, { type: "intro_request" });
    } catch (pushError) {
      console.warn("request-introduction: push delivery failed", pushError);
    }

    return new Response(JSON.stringify({ requestId: request.id }), { status: 200 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: err.message }), { status: 401 });
    }
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
});
```

- [ ] **Step 2: Verify by inspection**

Confirm the same 401-before-any-write ordering as Task 3, and confirm the push only ever targets `mutualFriendId` — never `targetId` or `requesterId`.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/request-introduction
git commit -m "feat: add request-introduction Edge Function"
```

---

### Task 5: Edge Function — respond-to-introduction

**Files:**
- Create: `supabase/functions/respond-to-introduction/index.ts`

**Interfaces:**
- Consumes: Task 2 shared utilities, plus `formatIntroAcceptedNotification`.
- Produces: `POST /respond-to-introduction` — body `{ introId: string, response: "accept" | "pass" }`, caller identity from the JWT must equal `introductions.user_a_id` or `user_b_id`. Returns `{ status: "pending_a" | "pending_b" | "accepted" | "passed" }`. Called by `lib/introductions.ts#respondToIntroduction` (Task 8), which is called from `app/intro/[id].tsx` (Task 10).

This is the state machine: `status` starts `both_pending`. One person accepting moves it to `pending_<the other person's letter>` (i.e. "waiting on them"). The second person accepting from that state moves it to `accepted` — only then does the matchmaker get notified. Either person passing at any point moves it straight to `passed` with no notification to anyone.

- [ ] **Step 1: Write the function**

```typescript
// supabase/functions/respond-to-introduction/index.ts
import { createAdminClient } from "../_shared/adminClient.ts";
import { getCallerId, UnauthorizedError } from "../_shared/verifyCaller.ts";
import { sendPushToUser } from "../_shared/sendExpoPush.ts";
import { formatIntroAcceptedNotification } from "../_shared/notificationCopy.ts";

Deno.serve(async (req: Request) => {
  try {
    const callerId = await getCallerId(req);
    const { introId, response } = await req.json();

    if (!introId || (response !== "accept" && response !== "pass")) {
      return new Response(
        JSON.stringify({ error: "introId and response ('accept'|'pass') are required" }),
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: intro, error: fetchError } = await admin
      .from("introductions")
      .select("id, matchmaker_id, user_a_id, user_b_id, status")
      .eq("id", introId)
      .maybeSingle();

    if (fetchError || !intro) {
      return new Response(JSON.stringify({ error: "Introduction not found" }), { status: 404 });
    }
    if (callerId !== intro.user_a_id && callerId !== intro.user_b_id) {
      return new Response(JSON.stringify({ error: "Not a participant in this introduction" }), { status: 403 });
    }
    if (intro.status === "accepted" || intro.status === "passed") {
      return new Response(JSON.stringify({ error: "This introduction is already resolved" }), { status: 409 });
    }

    const isUserA = callerId === intro.user_a_id;

    if (response === "pass") {
      // Guard the write with the status we just read (`.eq("status", ...)`)
      // so a concurrent response from the other participant can't be
      // silently clobbered — see the accept branch below for why this
      // matters more there. If nothing matched, the row moved between our
      // read and write; fail closed and let the caller retry against the
      // now-current state.
      const { data: updated, error: updateError } = await admin
        .from("introductions")
        .update({ status: "passed" })
        .eq("id", introId)
        .eq("status", intro.status)
        .select("id")
        .maybeSingle();
      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
      }
      if (!updated) {
        return new Response(JSON.stringify({ error: "This introduction changed — try again" }), { status: 409 });
      }
      // Silent rejection: no notification to anyone, ever.
      return new Response(JSON.stringify({ status: "passed" }), { status: 200 });
    }

    let newStatus: "pending_a" | "pending_b" | "accepted";
    if (intro.status === "both_pending") {
      newStatus = isUserA ? "pending_b" : "pending_a";
    } else if (intro.status === "pending_a" && isUserA) {
      newStatus = "accepted";
    } else if (intro.status === "pending_b" && !isUserA) {
      newStatus = "accepted";
    } else {
      return new Response(JSON.stringify({ error: "You've already responded to this introduction" }), { status: 409 });
    }

    // Same compare-and-swap guard as the pass branch. Without it, two
    // participants accepting at the same instant can both read
    // "both_pending", independently compute "pending_b" and "pending_a",
    // and whichever write lands last silently overwrites the other —
    // leaving the row on a pending status forever with neither accept
    // recorded, so the matchmaker never gets notified even though both
    // people genuinely accepted. Guarding the update on the status we read
    // makes the loser's write a no-op (`updated` is null) instead of a
    // silent overwrite; the loser gets a 409 and their client retries,
    // which reads the now-current status and computes the correct
    // transition.
    const { data: updated, error: updateError } = await admin
      .from("introductions")
      .update({ status: newStatus })
      .eq("id", introId)
      .eq("status", intro.status)
      .select("id")
      .maybeSingle();
    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
    }
    if (!updated) {
      return new Response(JSON.stringify({ error: "This introduction changed — try again" }), { status: 409 });
    }

    if (newStatus === "accepted") {
      const { title, body } = formatIntroAcceptedNotification();
      // The status is already committed at this point — push delivery is
      // best-effort and must never turn a successful status update into a
      // failure response.
      try {
        await sendPushToUser(admin, intro.matchmaker_id, title, body, { type: "intro_accepted" });
      } catch (pushError) {
        console.warn("respond-to-introduction: push delivery failed", pushError);
      }
    }

    return new Response(JSON.stringify({ status: newStatus }), { status: 200 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: err.message }), { status: 401 });
    }
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
});
```

- [ ] **Step 2: Verify the state machine by inspection**

Trace all four paths by hand against the code above and confirm each:
1. `both_pending` + user_a accepts → `pending_b`, no push sent.
2. `pending_b` + user_b accepts → `accepted`, push sent to `matchmaker_id` only.
3. `both_pending` + user_a passes → `passed`, no push sent, function returns before reaching any `sendPushToUser` call.
4. `pending_b` + user_a (who already accepted) accepts again → falls to the `else` branch → 409, no status change, no push.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/respond-to-introduction
git commit -m "feat: add respond-to-introduction Edge Function"
```

---

### Task 6: Edge Function — send-message

**Files:**
- Create: `supabase/functions/send-message/index.ts`

**Interfaces:**
- Consumes: Task 2 shared utilities, plus `formatMessageNotification`.
- Produces: `POST /send-message` — body `{ chatId: string, content: string }`, caller identity (= `sender_id`) from the JWT. Returns `{ messageId: string, createdAt: string }`. Called by `lib/chat.ts#sendMessage` (Task 9), which is called from `app/chat/[id].tsx` (Task 11).

- [ ] **Step 1: Write the function**

```typescript
// supabase/functions/send-message/index.ts
import { createAdminClient } from "../_shared/adminClient.ts";
import { getCallerId, UnauthorizedError } from "../_shared/verifyCaller.ts";
import { sendPushToUser } from "../_shared/sendExpoPush.ts";
import { formatMessageNotification } from "../_shared/notificationCopy.ts";

Deno.serve(async (req: Request) => {
  try {
    const senderId = await getCallerId(req);
    const { chatId, content } = await req.json();

    if (!chatId || typeof content !== "string" || !content.trim()) {
      return new Response(JSON.stringify({ error: "chatId and content are required" }), { status: 400 });
    }

    const admin = createAdminClient();

    const { data: chat, error: chatError } = await admin
      .from("chats")
      .select("id, introductions ( user_a_id, user_b_id )")
      .eq("id", chatId)
      .maybeSingle();

    if (chatError || !chat) {
      return new Response(JSON.stringify({ error: "Chat not found" }), { status: 404 });
    }

    const intro = chat.introductions as unknown as { user_a_id: string; user_b_id: string };
    if (senderId !== intro.user_a_id && senderId !== intro.user_b_id) {
      return new Response(JSON.stringify({ error: "Not a participant in this chat" }), { status: 403 });
    }

    const { data: message, error: insertError } = await admin
      .from("messages")
      .insert({ chat_id: chatId, sender_id: senderId, content: content.trim() })
      .select("id, created_at")
      .single();

    if (insertError || !message) {
      return new Response(JSON.stringify({ error: insertError?.message ?? "Insert failed" }), { status: 500 });
    }

    // The recipient is whichever of the two matched people did not send this
    // message. `intro` only ever carries user_a_id/user_b_id here — the
    // matchmaker_id column isn't even selected, so the firewall holds by
    // construction, not by a runtime check.
    const recipientId = senderId === intro.user_a_id ? intro.user_b_id : intro.user_a_id;

    const { data: sender } = await admin.from("users").select("name").eq("id", senderId).maybeSingle();
    const senderFirstName = (sender?.name ?? "Someone").split(" ")[0];
    const { title, body } = formatMessageNotification(senderFirstName);

    // Sent unconditionally, every time — no check of the recipient's
    // foreground/app-open state. Gating delivery on presence would make the
    // notification double as a read receipt, which Wing never has.
    //
    // The message is already committed at this point — push delivery is
    // best-effort and must never turn a successful send into a failure
    // response (a client retry on 500 would create a duplicate message).
    try {
      await sendPushToUser(admin, recipientId, title, body, { type: "message", chatId });
    } catch (pushError) {
      console.warn("send-message: push delivery failed", pushError);
    }

    return new Response(
      JSON.stringify({ messageId: message.id, createdAt: message.created_at }),
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: err.message }), { status: 401 });
    }
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
});
```

- [ ] **Step 2: Verify the firewall by inspection**

Confirm `chat.introductions` selects only `user_a_id, user_b_id` — `matchmaker_id` never appears in this file, so there is no code path in this function that could ever send a push to the matchmaker.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/send-message
git commit -m "feat: add send-message Edge Function"
```

---

### Task 7: lib/notifications.ts — push registration + tap routing

**Files:**
- Modify: `lib/notifications.ts`

**Interfaces:**
- Consumes: `supabase` client (`lib/supabase.ts`), `expo-notifications`, `expo-constants`.
- Produces: `registerForPushNotificationsAsync(userId: string): Promise<void>`, `WingNotificationData` type, `routeForNotificationData(data: WingNotificationData): string`. Used by `app/_layout.tsx` (Task 12).

- [ ] **Step 1: Read the current file**

Already read at the top of this session — it exports only `formatMessageNotification`. Keep that function's behavior identical; add to it.

- [ ] **Step 2: Extend the file**

```typescript
// lib/notifications.ts
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Without an explicit handler, notifications fired while the app is
// foregrounded don't show a banner on current Expo SDKs. shouldPlaySound
// must stay true — on Android, false suppresses the heads-up banner
// entirely regardless of shouldShowBanner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type WingNotificationData =
  | { type: "intro"; introId: string }
  | { type: "intro_accepted" }
  | { type: "message"; chatId: string }
  | { type: "intro_request" };

/**
 * Push copy for the message-notification path. Wing always names the
 * person, never generic "new message" language — mirrors the intro-note
 * copy rule ("Maya thinks you two should meet"). The Edge Function
 * (supabase/functions/_shared/notificationCopy.ts) is the actual runtime
 * source of the push body — this stays hand-synced with it.
 */
export function formatMessageNotification(senderFirstName: string) {
  return {
    title: senderFirstName,
    body: `${senderFirstName} sent you a message`,
  };
}

/**
 * Requests push permission, gets an Expo push token, and upserts it into
 * `push_tokens`. No-ops if no EAS project id is configured yet (app.json /
 * eas.json don't set one as of this writing) — getExpoPushTokenAsync
 * requires one and would throw otherwise.
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<void> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    return;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    return;
  }

  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });

  const { error } = await supabase
    .from("push_tokens")
    .upsert(
      { user_id: userId, expo_push_token: expoPushToken, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (error) {
    throw error;
  }
}

/** Maps a notification's data payload to the screen it should open. */
export function routeForNotificationData(data: WingNotificationData): string {
  switch (data.type) {
    case "intro":
      return `/intro/${data.introId}`;
    case "message":
      return `/chat/${data.chatId}`;
    case "intro_accepted":
      return "/(tabs)/intros";
    case "intro_request":
      return "/(tabs)";
  }
}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add lib/notifications.ts
git commit -m "feat: add push registration and notification tap-routing to lib/notifications"
```

---

### Task 8: lib/introductions.ts — client service layer

**Files:**
- Create: `lib/introductions.ts`

**Interfaces:**
- Consumes: `supabase` client (`lib/supabase.ts`), `send-introduction` / `request-introduction` / `respond-to-introduction` Edge Functions (Tasks 3-5).
- Produces: `sendIntroduction(userAId: string, userBId: string, note: string): Promise<string>`, `requestIntroduction(targetId: string, mutualFriendId: string): Promise<string>`, `respondToIntroduction(introId: string, response: "accept" | "pass"): Promise<IntroResponseResult>`, `IntroResponseResult` type. `respondToIntroduction` is used by `app/intro/[id].tsx` (Task 10); `sendIntroduction`/`requestIntroduction` are ready for the not-yet-built Matchmaker Step 2 and Request-an-Intro screens to call.

- [ ] **Step 1: Write the file**

```typescript
// lib/introductions.ts
import { supabase } from "./supabase";

export async function sendIntroduction(userAId: string, userBId: string, note: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ introId: string }>("send-introduction", {
    body: { userAId, userBId, note },
  });
  if (error) throw error;
  return data!.introId;
}

export async function requestIntroduction(targetId: string, mutualFriendId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ requestId: string }>("request-introduction", {
    body: { targetId, mutualFriendId },
  });
  if (error) throw error;
  return data!.requestId;
}

export type IntroResponseResult = "pending_a" | "pending_b" | "accepted" | "passed";

/**
 * respond-to-introduction guards its status update with a compare-and-swap
 * and returns 409 if the row changed between its read and write (e.g. the
 * other participant responded at nearly the same instant). That 409 doesn't
 * mean this response failed — it means the attempt needs to be resubmitted
 * against the now-current status, which is why this retries once before
 * giving up. Without the retry, a genuine simultaneous double-accept could
 * silently fail to notify the matchmaker from the loser's side.
 */
export async function respondToIntroduction(
  introId: string,
  response: "accept" | "pass"
): Promise<IntroResponseResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase.functions.invoke<{ status: IntroResponseResult }>(
      "respond-to-introduction",
      { body: { introId, response } }
    );
    if (!error) {
      return data!.status;
    }
    const isStatusConflict =
      "context" in error && error.context instanceof Response && error.context.status === 409;
    if (!isStatusConflict || attempt === 1) {
      throw error;
    }
  }
  throw new Error("respondToIntroduction: unreachable");
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add lib/introductions.ts
git commit -m "feat: add client service layer for introductions"
```

---

### Task 9: lib/chat.ts — client service layer

**Files:**
- Create: `lib/chat.ts`

**Interfaces:**
- Consumes: `supabase` client (`lib/supabase.ts`), `send-message` Edge Function (Task 6).
- Produces: `sendMessage(chatId: string, content: string): Promise<{ messageId: string; createdAt: string }>`. Used by `app/chat/[id].tsx` (Task 11).

- [ ] **Step 1: Write the file**

```typescript
// lib/chat.ts
import { supabase } from "./supabase";

export async function sendMessage(
  chatId: string,
  content: string
): Promise<{ messageId: string; createdAt: string }> {
  const { data, error } = await supabase.functions.invoke<{ messageId: string; createdAt: string }>(
    "send-message",
    { body: { chatId, content } }
  );
  if (error) throw error;
  return data!;
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add lib/chat.ts
git commit -m "feat: add client service layer for chat messages"
```

---

### Task 10: Wire accept/pass in app/intro/[id].tsx

**Files:**
- Modify: `app/intro/[id].tsx:1-19` (imports), `app/intro/[id].tsx:84-106` (`handleSkip`, `handleAccept`)

**Interfaces:**
- Consumes: `respondToIntroduction` (Task 8, `lib/introductions.ts`).

Note: `MOCK_INTROS` still drives which intro is displayed on this screen (that data wiring is a separate, not-yet-approved task), so `intro.id` values like `"1"`/`"2"` won't match a real `introductions` row yet — the call will fail gracefully and be caught. This step wires the real call site so it's correct the moment the screen is wired to live data; it does not itself wire the screen to live data.

- [ ] **Step 1: Read the current file**

Already read at the top of this session (lines 1-183).

- [ ] **Step 2: Add the import**

```typescript
import { respondToIntroduction } from "../../lib/introductions";
```

Add it after the existing `import { useAuthStore } from "../../store/auth";` line.

- [ ] **Step 3: Replace handleSkip and handleAccept**

Replace:

```typescript
  function handleSkip() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log(`[intro:${introId}] skipped`);
    if (router.canGoBack()) router.back();
  }
```

with:

```typescript
  function handleSkip() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (introId) {
      respondToIntroduction(introId, "pass").catch((err) => console.warn("failed to record pass", err));
    }
    if (router.canGoBack()) router.back();
  }
```

Replace:

```typescript
  function handleAccept() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    acceptScale.value = withSequence(withSpring(1.06, spring), withSpring(1, spring));
    console.log(`[intro:${introId}] accepted`);
    setTimeout(() => {
      if (router.canGoBack()) router.back();
    }, 180);
  }
```

with:

```typescript
  function handleAccept() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    acceptScale.value = withSequence(withSpring(1.06, spring), withSpring(1, spring));
    if (introId) {
      respondToIntroduction(introId, "accept").catch((err) => console.warn("failed to record accept", err));
    }
    setTimeout(() => {
      if (router.canGoBack()) router.back();
    }, 180);
  }
```

`handleSnooze` is untouched — the existing TODO comment above it (no "snoozed" status on `introductions`) still applies and is out of scope here.

- [ ] **Step 4: Verify**

Run: `npm run typecheck`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add app/intro/[id].tsx
git commit -m "feat: wire intro accept/pass to respond-to-introduction Edge Function"
```

---

### Task 11: Wire send in app/chat/[id].tsx

**Files:**
- Modify: `app/chat/[id].tsx:1-14` (imports), `app/chat/[id].tsx:30-43` (`handleSend`)

**Interfaces:**
- Consumes: `sendMessage` (Task 9, `lib/chat.ts`).

Same caveat as Task 10: `MOCK_CHATS`/`MOCK_MESSAGES` still drive this screen's UI, so `id` won't match a real `chats` row until the screen is wired to live data. The local optimistic `setMessages` call is left exactly as-is; the real persistence call is added alongside it, not in place of it.

- [ ] **Step 1: Read the current file**

Already read at the top of this session (lines 1-87).

- [ ] **Step 2: Add the import**

```typescript
import { sendMessage } from "../../lib/chat";
```

Add it after `import { MOCK_CHATS } from "../../components/chats/mockChats";`.

- [ ] **Step 3: Replace handleSend**

Replace:

```typescript
  function handleSend(content: string) {
    const message: Message = {
      id: `local-${Date.now()}`,
      chatId: id ?? "",
      senderId: "me",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, message]);
    // TODO: persist to `messages` table. The Supabase Edge Function that
    // fans this out should build its push body with
    // lib/notifications.ts#formatMessageNotification — never a generic
    // "you have a new message" string.
  }
```

with:

```typescript
  function handleSend(content: string) {
    const message: Message = {
      id: `local-${Date.now()}`,
      chatId: id ?? "",
      senderId: "me",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, message]);
    if (id) {
      sendMessage(id, content).catch((err) => console.warn("failed to send message", err));
    }
  }
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add app/chat/[id].tsx
git commit -m "feat: wire chat send to send-message Edge Function"
```

---

### Task 12: Wire push registration + tap routing in app/_layout.tsx

**Files:**
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: `registerForPushNotificationsAsync`, `routeForNotificationData`, `WingNotificationData` (Task 7, `lib/notifications.ts`), `useAuthStore` (already imported).

- [ ] **Step 1: Read the current file**

Already read at the top of this session (lines 1-75).

- [ ] **Step 2: Add imports**

Replace:

```typescript
import "../global.css";

import { useEffect, useState } from "react";
import { useAuthStore } from "../store/auth";
import { Stack } from "expo-router";
```

with:

```typescript
import "../global.css";

import { useEffect, useState } from "react";
import { useAuthStore } from "../store/auth";
import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";
import {
  registerForPushNotificationsAsync,
  routeForNotificationData,
  type WingNotificationData,
} from "../lib/notifications";
```

- [ ] **Step 3: Register for push once a user is signed in, and route on notification tap**

Replace:

```typescript
export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  // Custom fonts can't vary by `fontWeight` on native — each weight is its own
  // family. These keys are the family names referenced in constants/typography.ts
  // and tailwind.config.js. Keep all three in sync.
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque: BricolageGrotesque_700Bold,
    "BricolageGrotesque-SemiBold": BricolageGrotesque_600SemiBold,
    DMSans: DMSans_400Regular,
    "DMSans-Medium": DMSans_600SemiBold,
    "DMSans-Bold": DMSans_700Bold,
    DMMono: DMMono_400Regular,
    "DMMono-Medium": DMMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
      useAuthStore.getState().initialize();
    }
  }, [fontsLoaded, fontError]);
```

with:

```typescript
export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const user = useAuthStore((s) => s.user);

  // Custom fonts can't vary by `fontWeight` on native — each weight is its own
  // family. These keys are the family names referenced in constants/typography.ts
  // and tailwind.config.js. Keep all three in sync.
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque: BricolageGrotesque_700Bold,
    "BricolageGrotesque-SemiBold": BricolageGrotesque_600SemiBold,
    DMSans: DMSans_400Regular,
    "DMSans-Medium": DMSans_600SemiBold,
    "DMSans-Bold": DMSans_700Bold,
    DMMono: DMMono_400Regular,
    "DMMono-Medium": DMMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
      useAuthStore.getState().initialize();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (user) {
      registerForPushNotificationsAsync(user.id).catch((err) =>
        console.warn("push registration failed", err)
      );
    }
  }, [user]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as WingNotificationData;
      router.push(routeForNotificationData(data));
    });
    return () => subscription.remove();
  }, []);
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: register for push notifications and route on notification tap"
```

---

### Task 13: Deploy — manual steps (no automated verification, run by hand)

**Files:** none (documentation of commands to run outside this session).

This environment has no Supabase CLI and no project credentials, so this task is a checklist for you to run yourself, matching how schema changes are already applied in this project (by hand, one script at a time).

- [ ] **Step 1: Apply the schema**

Open the Supabase Studio SQL Editor for the Wing project and paste/run the full contents of `supabase/sql/001_notifications_schema.sql`. Confirm with the two verification queries from Task 1, Step 2.

- [ ] **Step 2: Install and link the Supabase CLI**

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
```

`<your-project-ref>` is the id in your Supabase project's URL (`https://<project-ref>.supabase.co`).

- [ ] **Step 3: Deploy the four Edge Functions**

```bash
supabase functions deploy send-introduction
supabase functions deploy request-introduction
supabase functions deploy respond-to-introduction
supabase functions deploy send-message
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically into every Edge Function's environment by Supabase — no manual secret-setting needed for this plan.

- [ ] **Step 4: Confirm the 401 path on a deployed function**

```bash
curl -i https://<your-project-ref>.functions.supabase.co/send-introduction
```

Expected: `HTTP/2 401` with body `{"error":"Missing bearer token"}` — confirms the function is live and rejects unauthenticated calls before touching the database.

- [ ] **Step 5: Configure an EAS project id for real device push tokens**

`registerForPushNotificationsAsync` (Task 7) no-ops today because `app.json`/`eas.json` don't set `extra.eas.projectId`. Once you run `eas init` (outside this plan's scope — it's an EAS account action, not a code change), add the generated project id under `expo.extra.eas.projectId` in `app.json`. Until then, this feature is fully built and deployed but push tokens won't register on real devices.
