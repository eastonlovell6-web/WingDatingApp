export interface LeaderboardEntry {
  id: string;
  name: string;
  avatarUri?: string;
  // matchmaker_stats.intros_accepted — an aggregate count only. Ranking on
  // this (not intros_sent) avoids rewarding someone for spamming their
  // 3-pending-intro cap with intros that never land.
  introsAccepted: number;
  // Only used as a tie-break below, never rendered.
  introsSent?: number;
  isCurrentUser?: boolean;
}

export function rankedLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort(
    (a, b) =>
      b.introsAccepted - a.introsAccepted ||
      (b.introsSent ?? 0) - (a.introsSent ?? 0) ||
      a.id.localeCompare(b.id)
  );
}
