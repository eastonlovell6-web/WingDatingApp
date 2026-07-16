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

// Upsert on (owner_id, slot_index) with ignoreDuplicates: a losing concurrent
// seed attempt (e.g. two devices opening the Invite page at once) silently
// no-ops instead of creating extra rows past the 5-slot cap. A 23505 here is
// therefore always the *code* unique constraint (astronomically rare random
// collision, not the slot race) — retry with a freshly generated code.
async function insertInviteSlot(userId: string, slotIndex: number, attempt = 0): Promise<void> {
  const { error } = await supabase.from("invites").upsert(
    { owner_id: userId, slot_index: slotIndex, code: generateInviteCode() },
    { onConflict: "owner_id,slot_index", ignoreDuplicates: true }
  );
  if (error) {
    if (error.code === "23505" && attempt < 5) {
      return insertInviteSlot(userId, slotIndex, attempt + 1);
    }
    throw error;
  }
}

async function seedInviteSlots(userId: string): Promise<void> {
  for (let i = 0; i < SLOT_COUNT; i++) {
    await insertInviteSlot(userId, i);
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
    .order("slot_index", { ascending: true });
  if (selectError) throw selectError;
  if (existing && existing.length > 0) return existing;

  await seedInviteSlots(userId);

  const { data: seeded, error: reselectError } = await supabase
    .from("invites")
    .select("id, code, status")
    .eq("owner_id", userId)
    .order("slot_index", { ascending: true });
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
