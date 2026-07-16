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
