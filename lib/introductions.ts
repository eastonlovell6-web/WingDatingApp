// lib/introductions.ts
import { supabase } from "./supabase";
import type { SentIntro } from "../components/intros/mockSentIntros";

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

export async function withdrawIntroduction(introId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("withdraw-introduction", { body: { introId } });
  if (error) throw error;
}

export async function nudgeIntroduction(introId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("nudge-introduction", { body: { introId } });
  if (error) throw error;
}

/**
 * Two-step fetch (introductions, then users by id) rather than a PostgREST
 * embed, matching getMatchmakerFriends' convention in lib/friendships.ts —
 * introductions has three FKs into users (matchmaker_id/user_a_id/
 * user_b_id), so an embed would need explicit constraint-name hints anyway.
 * Withdrawn intros are excluded — once withdrawn they simply disappear from
 * the matchmaker's sent list, there's no "Withdrawn" UI state to show.
 */
export async function getSentIntroductions(matchmakerId: string): Promise<SentIntro[]> {
  const { data: intros, error } = await supabase
    .from("introductions")
    .select("id, user_a_id, user_b_id, note, status, created_at")
    .eq("matchmaker_id", matchmakerId)
    .neq("status", "withdrawn")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const userIds = Array.from(new Set((intros ?? []).flatMap((i) => [i.user_a_id, i.user_b_id])));
  const { data: users, error: usersError } =
    userIds.length > 0
      ? await supabase.from("users").select("id, name, photos").in("id", userIds)
      : { data: [], error: null };
  if (usersError) throw usersError;

  const userById = new Map((users ?? []).map((u) => [u.id, u]));

  return (intros ?? []).map((intro) => {
    const userA = userById.get(intro.user_a_id);
    const userB = userById.get(intro.user_b_id);
    return {
      id: intro.id,
      personAName: userA?.name ?? "Someone",
      personAAvatarUri: userA?.photos?.[0] ?? undefined,
      personBName: userB?.name ?? "Someone",
      personBAvatarUri: userB?.photos?.[0] ?? undefined,
      sentAt: intro.created_at,
      // Only ever 'pending' | 'matched' — see mockSentIntros.ts's SentIntro
      // comment: the matchmaker firewall means a pass must never surface as
      // its own state, so it stays 'pending' forever.
      status: intro.status === "accepted" ? "matched" : "pending",
      note: intro.note,
    };
  });
}
