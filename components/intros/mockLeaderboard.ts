export interface LeaderboardEntry {
  id: string;
  name: string;
  avatarUri?: string;
  // matchmaker_stats.intros_accepted — an aggregate count only. Ranking on
  // this (not intros_sent) avoids rewarding someone for spamming their
  // 3-pending-intro cap with intros that never land.
  introsAccepted: number;
  isCurrentUser?: boolean;
}

// Throwaway fixture until this queries `matchmaker_stats` scoped to the
// signed-in user's friend group. Aggregate counts only — no chat/status
// data, per the matchmaker-firewall privacy rule.
export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  {
    id: "1",
    name: "Maya Chen",
    avatarUri: "https://i.pravatar.cc/300?img=5",
    introsAccepted: 7,
  },
  {
    id: "2",
    name: "Easton Lovell",
    introsAccepted: 4,
    isCurrentUser: true,
  },
  {
    id: "3",
    name: "Sam Rivera",
    avatarUri: "https://i.pravatar.cc/300?img=12",
    introsAccepted: 3,
  },
  {
    id: "4",
    name: "Priya Nair",
    avatarUri: "https://i.pravatar.cc/300?img=47",
    introsAccepted: 1,
  },
];

export function rankedLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => b.introsAccepted - a.introsAccepted);
}
