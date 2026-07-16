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

export type FriendEligibility = "eligible" | "not_opted_in" | "at_cap" | "not_looking";

export function getFriendEligibility(friend: MatchmakerFriend): FriendEligibility {
  if (!friend.lookingToGetSetUp) return "not_looking";
  if (!friend.canIntroduce) return "not_opted_in";
  if (friend.activePendingCount >= 3) return "at_cap";
  return "eligible";
}

export function getIneligibleCaption(eligibility: FriendEligibility): string | undefined {
  if (eligibility === "not_looking") return "Not looking to be set up";
  if (eligibility === "not_opted_in") return "Hasn't opted in";
  if (eligibility === "at_cap") return "3 pending intros";
  return undefined;
}

// Throwaway bio-prompt text for the daily-prompt flow's keyword matching
// (lib/promptMatch.ts), keyed by real friend id. `users` has no bio-prompt
// text wired for this flow yet, so real friends simply match no keywords
// (lib/promptMatch.ts's friendBioText falls back to "") and the list is
// left in its existing order.
export const MOCK_BIO_TEXT: Record<string, string> = {};
