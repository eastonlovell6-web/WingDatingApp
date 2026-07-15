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

// Throwaway bio-prompt text for the daily-prompt flow's keyword matching
// (lib/promptMatch.ts) — same ids as MOCK_MATCHMAKER_FRIENDS above. This
// flow is still fully mock end to end (getIntroducibleFriends below), so
// this stays local rather than reading real bio_prompts from Supabase.
export const MOCK_BIO_TEXT: Record<string, string> = {
  "1": "I will never turn down... A pickup game of pickleball, any time of day.",
  "2": "The last thing that made me laugh out loud was... My little sister's audition tape for a cooking show.",
  "3": "Ask me about the time I... Talked my way onto a closed ski lift in a snowstorm.",
  "4": "I'm weirdly competitive about... Trivia night. I keep a running scoreboard on my fridge.",
  "5": "I could talk for an hour about... Why the 1997 Jazz should've won it all.",
  "6": "My friends would describe me in three words as... Loud, loyal, chronically late.",
  "7": "A skill I'm proud of that has zero practical use... I can solve a Rubik's cube behind my back.",
};

// The wingman's introducible friends for the daily-prompt flow — friends
// who've opted this user in to introduce them. Reordered elsewhere by
// keyword match, never filtered further here (lookingToGetSetUp / pending
// cap are re-checked downstream by getFriendEligibility when the picked
// friend lands on Matchmaker Step 1 via ?preselect=).
export function getIntroducibleFriends(): MatchmakerFriend[] {
  return MOCK_MATCHMAKER_FRIENDS.filter((friend) => friend.canIntroduce);
}
