import type { MatchmakerBadge, MatchmakerRankProgress } from "../components/profile/mockProfile";

/**
 * Accepted intros weighted 5x sent ones — rewards intros that actually land,
 * not just hitting send (matches the leaderboard's own ranking rationale in
 * components/intros/mockLeaderboard.ts).
 */
export function computeMatchmakerScore(introsSent: number, introsAccepted: number): number {
  return Math.min(100, introsAccepted * 15 + introsSent * 3);
}

export function computeNextMilestoneCopy(introsAccepted: number): string {
  const nextTarget = introsAccepted === 0 ? 5 : (Math.floor(introsAccepted / 5) + 1) * 5;
  const remaining = nextTarget - introsAccepted;
  return `${remaining} more accepted intro${remaining === 1 ? "" : "s"} to reach ${nextTarget}`;
}

export function computePercentileLabel(rank: number, groupSize: number): string {
  if (groupSize < 2) return "Invite friends to see how you rank.";
  const percentile = Math.round((1 - (rank - 1) / groupSize) * 100);
  return `You're in the top ${percentile}% of matchmakers in your friend group.`;
}

export function computeBadges(
  introsSent: number,
  introsAccepted: number,
  rank: number,
  groupSize: number
): MatchmakerBadge[] {
  const badges: MatchmakerBadge[] = [];
  if (rank === 1 && groupSize >= 2) {
    badges.push({ id: "top", label: "Top Matchmaker", tone: "butter", variant: "outline" });
  }
  if (introsSent >= 5) {
    badges.push({ id: "sent5", label: "5 Intros Sent", tone: "plum", variant: "outline" });
  }
  if (introsAccepted >= 3) {
    badges.push({ id: "accepted3", label: "3 Matches Made", tone: "mint", variant: "outline" });
  }
  return badges;
}

const XP_PER_LEVEL = 150;

function tierForLevel(level: number): MatchmakerRankProgress["tier"] {
  if (level >= 7) return "Matchmaker Legend";
  if (level >= 5) return "Cupid";
  if (level >= 3) return "Setup Artist";
  return "Wingperson";
}

/** XP is lifetime and never resets — a separate concept from the weekly streak below. */
export function computeRankLevel(
  introsSent: number,
  introsAccepted: number
): { xpCurrent: number; level: number; xpForNextLevel: number; tier: MatchmakerRankProgress["tier"] } {
  const xpCurrent = introsSent * 10 + introsAccepted * 25;
  const level = Math.floor(xpCurrent / XP_PER_LEVEL) + 1;
  return { xpCurrent, level, xpForNextLevel: level * XP_PER_LEVEL, tier: tierForLevel(level) };
}

function startOfWeek(date: Date): number {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Weeks are Monday-anchored. streakAtRisk means last week had an intro sent
 * but this week doesn't yet — the streak survives until this week ends.
 */
export function computeStreak(
  sentAtIsoTimestamps: string[],
  now: Date = new Date()
): { streakWeeks: number; streakAtRisk: boolean; streakResetsInDays: number } {
  const activeWeeks = new Set(sentAtIsoTimestamps.map((iso) => startOfWeek(new Date(iso))));
  const currentWeekStart = startOfWeek(now);
  const lastWeekStart = currentWeekStart - WEEK_MS;

  let anchor: number;
  let streakAtRisk: boolean;
  if (activeWeeks.has(currentWeekStart)) {
    anchor = currentWeekStart;
    streakAtRisk = false;
  } else if (activeWeeks.has(lastWeekStart)) {
    anchor = lastWeekStart;
    streakAtRisk = true;
  } else {
    return { streakWeeks: 0, streakAtRisk: false, streakResetsInDays: 0 };
  }

  let streakWeeks = 0;
  let cursor = anchor;
  while (activeWeeks.has(cursor)) {
    streakWeeks += 1;
    cursor -= WEEK_MS;
  }

  const streakResetsInDays = streakAtRisk
    ? Math.ceil((currentWeekStart + WEEK_MS - now.getTime()) / DAY_MS)
    : 0;

  return { streakWeeks, streakAtRisk, streakResetsInDays };
}
