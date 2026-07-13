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

// Throwaway fixture data until friendships/introductions are wired to Supabase.
export const MOCK_MATCHMAKER_FRIENDS: MatchmakerFriend[] = [
  { id: "1", name: "Sam Rivera", canIntroduce: true, activePendingCount: 0, lookingToGetSetUp: true },
  { id: "2", name: "Priya Nair", canIntroduce: true, activePendingCount: 1, lookingToGetSetUp: true },
  { id: "3", name: "Jordan Blake", canIntroduce: true, activePendingCount: 0, lookingToGetSetUp: true },
  { id: "4", name: "Maya Chen", canIntroduce: true, activePendingCount: 0, lookingToGetSetUp: false },
  { id: "5", name: "Theo Marsh", canIntroduce: false, activePendingCount: 0, lookingToGetSetUp: true },
  { id: "6", name: "Ana Sousa", canIntroduce: true, activePendingCount: 3, lookingToGetSetUp: true },
  { id: "7", name: "Kai Fischer", canIntroduce: true, activePendingCount: 2, lookingToGetSetUp: true },
];
