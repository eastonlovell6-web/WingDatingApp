export interface MatchmakerFriend {
  id: string;
  name: string;
  imageUri?: string;
  canIntroduce: boolean; // friendships.can_introduce for this friend -> current user
  activePendingCount: number; // count of introductions where this friend is
                               // user_a_id/user_b_id and status is pending_a/
                               // pending_b/both_pending
}

export type FriendEligibility = "eligible" | "not_opted_in" | "at_cap";

export function getFriendEligibility(friend: MatchmakerFriend): FriendEligibility {
  if (!friend.canIntroduce) return "not_opted_in";
  if (friend.activePendingCount >= 3) return "at_cap";
  return "eligible";
}

export function getIneligibleCaption(eligibility: FriendEligibility): string | undefined {
  if (eligibility === "not_opted_in") return "Hasn't opted in";
  if (eligibility === "at_cap") return "3 pending intros";
  return undefined;
}

// Throwaway fixture data until friendships/introductions are wired to Supabase.
export const MOCK_MATCHMAKER_FRIENDS: MatchmakerFriend[] = [
  { id: "1", name: "Sam Rivera", canIntroduce: true, activePendingCount: 0 },
  { id: "2", name: "Priya Nair", canIntroduce: true, activePendingCount: 1 },
  { id: "3", name: "Jordan Blake", canIntroduce: true, activePendingCount: 0 },
  { id: "4", name: "Maya Chen", canIntroduce: true, activePendingCount: 0 },
  { id: "5", name: "Theo Marsh", canIntroduce: false, activePendingCount: 0 },
  { id: "6", name: "Ana Sousa", canIntroduce: true, activePendingCount: 3 },
  { id: "7", name: "Kai Fischer", canIntroduce: true, activePendingCount: 2 },
];
