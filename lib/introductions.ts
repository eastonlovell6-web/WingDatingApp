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
