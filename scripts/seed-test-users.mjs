// scripts/seed-test-users.mjs
//
// Seeds a set of fake "friend" accounts (real auth.users + users rows) and
// wires them to your own already-onboarded test account via friendships,
// introductions, chats, and messages — so every screen's real Supabase
// queries have something rich to show, without touching any app code.
//
// Idempotent: every fake user's phone starts with SEED_PHONE_PREFIX, so
// re-running this script first deletes anything it seeded last time
// (in FK-safe order) before recreating it. It never touches your real
// account or any phone number outside that prefix.
//
// Usage:
//   node --env-file=.env.local scripts/seed-test-users.mjs +15551234567
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (Supabase dashboard ->
// Project Settings -> API -> service_role secret). Never commit that key —
// .env.local is already gitignored. The phone argument is the E.164 number
// of the account you already onboarded and use to test with.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_ACCOUNT_PHONE = process.argv[2];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase dashboard -> Project Settings -> API -> service_role secret) and run with --env-file=.env.local."
  );
  process.exit(1);
}
if (!TEST_ACCOUNT_PHONE) {
  console.error(
    "Usage: node --env-file=.env.local scripts/seed-test-users.mjs +1XXXXXXXXXX\n" +
      "Pass the E.164 phone number of your own already-onboarded test account."
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_PHONE_PREFIX = "+19995551";

function pravatar(n) {
  return `https://i.pravatar.cc/400?img=${n}`;
}

const FAKE_USERS = [
  {
    phone: `${SEED_PHONE_PREFIX}000`,
    name: "Maya Chen",
    role: "wing-somebody",
    photos: [pravatar(1), pravatar(2)],
    prompts: [
      { question: "I could talk for an hour about...", answer: "Why everyone I know needs to be set up with someone." },
      { question: "My friends would describe me in three words as...", answer: "Relentless, warm, nosy." },
    ],
  },
  {
    phone: `${SEED_PHONE_PREFIX}001`,
    name: "Jordan Reyes",
    role: "wing-somebody",
    photos: [pravatar(3), pravatar(4)],
    prompts: [
      { question: "Ask me about the time I...", answer: "Set up two of my roommates and they're engaged now." },
      { question: "I'm weirdly competitive about...", answer: "Fantasy football, unfortunately." },
    ],
  },
  {
    phone: `${SEED_PHONE_PREFIX}002`,
    name: "Priya Patel",
    role: "wing-me",
    photos: [pravatar(5), pravatar(6)],
    prompts: [
      { question: "The last thing that made me laugh out loud was...", answer: "My little brother's attempt at a TikTok dance." },
      { question: "If you came over, you'd immediately notice...", answer: "The absurd number of houseplants." },
    ],
  },
  {
    phone: `${SEED_PHONE_PREFIX}003`,
    name: "Tyler Brooks",
    role: "wing-me",
    photos: [pravatar(7), pravatar(8)],
    prompts: [
      { question: "A skill I'm proud of that has zero practical use...", answer: "I can name every state capital in under a minute." },
      { question: "I'm still figuring out...", answer: "How to make sourdough that isn't a hockey puck." },
    ],
  },
  {
    phone: `${SEED_PHONE_PREFIX}004`,
    name: "Sofia Martins",
    role: "wing-me",
    photos: [pravatar(9), pravatar(10)],
    prompts: [
      { question: "The most spontaneous thing I've ever done was...", answer: "Booked a one-way flight to Lisbon with two days' notice." },
      { question: "I will never turn down...", answer: "A pour-over and a good playlist." },
    ],
  },
  {
    phone: `${SEED_PHONE_PREFIX}005`,
    name: "Marcus Webb",
    role: "wing-me",
    photos: [pravatar(11), pravatar(12)],
    prompts: [
      { question: "My friends would describe me in three words as...", answer: "Loud, loyal, late." },
      { question: "I could talk for an hour about...", answer: "Why the 2016 draft class changed the NBA forever." },
    ],
  },
  {
    phone: `${SEED_PHONE_PREFIX}006`,
    name: "Ava Thompson",
    role: "wing-me",
    photos: [pravatar(13), pravatar(14)],
    prompts: [
      { question: "Ask me about the time I...", answer: "Hiked the Narrows in shoes two sizes too small." },
      { question: "I'm weirdly competitive about...", answer: "Trivia night. Deathly serious about it." },
    ],
  },
  {
    phone: `${SEED_PHONE_PREFIX}007`,
    name: "Noah Kim",
    role: "wing-me",
    photos: [pravatar(15), pravatar(16)],
    prompts: [
      { question: "The last thing that made me laugh out loud was...", answer: "A raccoon video my mom sent completely unprompted." },
      { question: "I will never turn down...", answer: "A pickup basketball game, any time of day." },
    ],
  },
];

async function wipeSeededData(fakeIds) {
  if (fakeIds.length === 0) return;
  const csv = fakeIds.join(",");

  const { data: introRows } = await admin
    .from("introductions")
    .select("id")
    .or(`matchmaker_id.in.(${csv}),user_a_id.in.(${csv}),user_b_id.in.(${csv})`);
  const introIds = (introRows ?? []).map((r) => r.id);

  if (introIds.length) {
    const { data: chatRows } = await admin.from("chats").select("id").in("intro_id", introIds);
    const chatIds = (chatRows ?? []).map((r) => r.id);
    if (chatIds.length) {
      await admin.from("messages").delete().in("chat_id", chatIds);
      await admin.from("chats").delete().in("id", chatIds);
    }
    await admin.from("introductions").delete().in("id", introIds);
  }

  await admin
    .from("intro_requests")
    .delete()
    .or(`requester_id.in.(${csv}),target_id.in.(${csv}),mutual_friend_id.in.(${csv})`);

  await admin.from("friendships").delete().or(`user_id.in.(${csv}),friend_id.in.(${csv})`);

  await admin.from("users").delete().in("id", fakeIds);

  for (const id of fakeIds) {
    await admin.auth.admin.deleteUser(id);
  }
}

async function findAuthUserByPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => (u.phone ?? "").replace(/\D/g, "") === digits);
    if (match) return match;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  // public.users.phone isn't populated by onboarding today — only Supabase
  // Auth itself reliably has the phone number — so look the account up
  // there instead of in the public.users table.
  const authUser = await findAuthUserByPhone(TEST_ACCOUNT_PHONE);
  if (!authUser) {
    throw new Error(
      `No account found for phone ${TEST_ACCOUNT_PHONE}. Finish onboarding on that account in the app first, then re-run this script.`
    );
  }
  const realUserId = authUser.id;

  const { data: realUserRow, error: realErr } = await admin
    .from("users")
    .select("id, name")
    .eq("id", realUserId)
    .maybeSingle();
  if (realErr) throw realErr;
  if (!realUserRow) {
    throw new Error(
      `Account ${realUserId} has no users row yet — finish onboarding (name/photos) in the app first, then re-run this script.`
    );
  }
  console.log(`Seeding against real test account: ${realUserRow.name ?? "(no name yet)"} (${realUserId})`);

  const { data: existingFake } = await admin.from("users").select("id").like("phone", `${SEED_PHONE_PREFIX}%`);
  const existingFakeIds = (existingFake ?? []).map((r) => r.id);
  if (existingFakeIds.length) {
    console.log(`Removing ${existingFakeIds.length} previously seeded fake user(s)...`);
    await wipeSeededData(existingFakeIds);
  }

  console.log(`Creating ${FAKE_USERS.length} fake users...`);
  const created = [];
  for (const spec of FAKE_USERS) {
    const { data: authUser, error: createErr } = await admin.auth.admin.createUser({
      phone: spec.phone,
      phone_confirm: true,
      user_metadata: { seed: true },
    });
    if (createErr) throw createErr;
    const id = authUser.user.id;

    const { error: insertErr } = await admin.from("users").insert({
      id,
      phone: spec.phone,
      name: spec.name,
      photos: spec.photos,
      bio_prompts: spec.prompts,
      role: spec.role,
    });
    if (insertErr) throw insertErr;

    created.push({ id, ...spec });
    console.log(`  + ${spec.name}`);
  }

  const [maya, jordan, priya, tyler, sofia, marcus, ava, noah] = created;

  console.log("Wiring friendships...");
  for (const [i, u] of created.entries()) {
    // Tyler's visibility toward the real account is off, so the Friend
    // Visibility screen and matchmaker friend-picker both have a real
    // "can't introduce" example to show, not just a wall of eligible friends.
    const canIntroduceRealUser = i !== 3;
    await admin.from("friendships").insert([
      { user_id: realUserId, friend_id: u.id, can_introduce: canIntroduceRealUser },
      { user_id: u.id, friend_id: realUserId, can_introduce: true },
    ]);
  }

  console.log("Creating introductions...");

  // A. Incoming on the real account's Home feed — nothing responded yet.
  const { data: introA } = await admin
    .from("introductions")
    .insert({
      matchmaker_id: jordan.id,
      user_a_id: priya.id,
      user_b_id: realUserId,
      note: "You two would get along so well — you're both obsessed with your Sunday hikes.",
      status: "both_pending",
    })
    .select("id")
    .single();

  // B. The real account's own accepted match — needs a chat + messages.
  const { data: introB } = await admin
    .from("introductions")
    .insert({
      matchmaker_id: maya.id,
      user_a_id: realUserId,
      user_b_id: noah.id,
      note: "Both of you would rather play pickup basketball than do literally anything else.",
      status: "accepted",
    })
    .select("id")
    .single();

  // C. Sent by the real account as matchmaker — still pending.
  await admin.from("introductions").insert({
    matchmaker_id: realUserId,
    user_a_id: tyler.id,
    user_b_id: sofia.id,
    note: "You two need to meet — trust me on this one.",
    status: "both_pending",
  });

  // D. Sent by the real account as matchmaker — matched, needs a chat too
  // (the real account should see "Matched" only, never the chat contents —
  // the matchmaker firewall — so this is here to sanity-check that screen).
  const { data: introD } = await admin
    .from("introductions")
    .insert({
      matchmaker_id: realUserId,
      user_a_id: marcus.id,
      user_b_id: ava.id,
      note: "Trivia night duo waiting to happen.",
      status: "accepted",
    })
    .select("id")
    .single();

  // E. Sent by the real account as matchmaker — silently passed. The real
  // account should never see any detail about this beyond it not converting.
  await admin.from("introductions").insert({
    matchmaker_id: realUserId,
    user_a_id: jordan.id,
    user_b_id: tyler.id,
    note: "Two of my favorite people, figured why not.",
    status: "passed",
  });

  // One pending intro request, for when the Request-an-Intro approval flow exists.
  await admin.from("intro_requests").insert({
    requester_id: priya.id,
    target_id: jordan.id,
    mutual_friend_id: realUserId,
    status: "pending",
  });

  console.log("Creating chats + messages...");

  const { data: chatB } = await admin.from("chats").insert({ intro_id: introB.id }).select("id").single();
  await admin.from("messages").insert([
    { chat_id: chatB.id, sender_id: noah.id, content: "Maya said you're the one to talk to about pickup runs on campus" },
    { chat_id: chatB.id, sender_id: realUserId, content: "Ha, she's not wrong. You free Thursday evening?" },
    { chat_id: chatB.id, sender_id: noah.id, content: "Yeah, works for me. West courts?" },
    { chat_id: chatB.id, sender_id: realUserId, content: "Perfect, see you there" },
  ]);

  const { data: chatD } = await admin.from("chats").insert({ intro_id: introD.id }).select("id").single();
  await admin.from("messages").insert([
    { chat_id: chatD.id, sender_id: marcus.id, content: "So apparently we're trivia-night material" },
    { chat_id: chatD.id, sender_id: ava.id, content: "Only if you're ready to lose to me" },
    { chat_id: chatD.id, sender_id: marcus.id, content: "We'll see about that" },
  ]);

  console.log("\nDone. Seeded:");
  console.log(`  ${created.length} fake friends (friendships wired both ways with your test account)`);
  console.log("  1 incoming intro on your Home feed (both_pending)");
  console.log("  1 accepted match of your own, with a chat thread (introB)");
  console.log("  2 intros you sent as matchmaker: 1 pending, 1 accepted with its own chat");
  console.log("  1 intro you sent that was silently passed");
  console.log("  1 pending intro request awaiting your approval as mutual friend");
  console.log(
    "\nRe-run this script any time to reset back to this same state — it cleans up its own fake users first."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
