export interface ProfilePrompt {
  question: string;
  answer: string;
}

// Fixed prompt bank — users pick one via the "Shuffle" button rather than
// writing their own question, so every question in the app reads consistently.
export const PRESET_PROMPT_QUESTIONS: string[] = [
  "I will never turn down...",
  "The last thing that made me laugh out loud was...",
  "I'm weirdly competitive about...",
  "Ask me about the time I...",
  "I could talk for an hour about...",
  "A skill I'm proud of that has zero practical use...",
  "My friends would describe me in three words as...",
  "The most spontaneous thing I've ever done was...",
  "I'm still figuring out...",
  "If you came over, you'd immediately notice...",
];

export interface MatchmakerBadge {
  id: string;
  label: string;
  tone: "coral" | "mint" | "butter" | "plum";
  variant?: "solid" | "outline";
}

export interface PrivacySettings {
  mutualFriendCountVisible: boolean;
  closeFriendsCanSuggestFreely: boolean;
  pausedNewIntros: boolean;
}

// Demo defaults shown only until the signed-in user's real `users` row has
// its own photos/prompts — see profile.tsx, which prefers real data as soon
// as any exists.
export const MOCK_PROFILE_USER = {
  name: "Easton Lovell",
  // TODO: age/school/location aren't columns on `users` yet — this stays a
  // placeholder until that data model exists.
  meta: "22 · BYU · Provo, UT",
};

export const MOCK_PHOTOS: string[] = [
  "https://i.pravatar.cc/400?img=51",
  "https://i.pravatar.cc/400?img=52",
  "https://i.pravatar.cc/400?img=53",
  "https://i.pravatar.cc/400?img=54",
];

export const MOCK_PROMPTS: ProfilePrompt[] = [
  {
    question: "The last thing that made me laugh out loud was...",
    answer: "My roommate's breakfast burrito review turning into a five-star Yelp post.",
  },
  {
    question: "I'm weirdly competitive about...",
    answer: "Cereal-pouring accuracy. Zero spills, every time.",
  },
];

// TODO: replace with a real `matchmaker_stats` row for the signed-in user.
export const MOCK_MATCHMAKER_STATS = {
  score: 82,
  percentileLabel: "You're in the top 15% of matchmakers this month.",
  introsSent: 6,
  introsAccepted: 4,
};

export interface MatchmakerRankProgress {
  tier: "Wingperson" | "Setup Artist" | "Cupid" | "Matchmaker Legend";
  level: number;
  xpCurrent: number;
  xpForNextLevel: number;
  streakWeeks: number;
  streakAtRisk: boolean;
  streakResetsInDays: number;
}

// TODO: replace with a real progression table once server-side rank/XP/streak
// tracking exists. tier/level/xp/streak are independent mock fields for now —
// not derived from `score` by any formula.
export const MOCK_RANK_PROGRESS: MatchmakerRankProgress = {
  tier: "Cupid",
  level: 4,
  xpCurrent: 340,
  xpForNextLevel: 500,
  streakWeeks: 3,
  streakAtRisk: true,
  streakResetsInDays: 1,
};

// TODO: replace once real progression math exists server-side. Precomputed
// nudge copy, not derived from a formula — same convention as score/
// percentileLabel above.
export const MOCK_NEXT_MILESTONE_COPY = "2 more intros to reach 100";

// TODO: replace with 0 sent-intros count from `matchmaker_stats` to test the empty nudge state for real.
export const MOCK_HAS_SENT_INTROS = true;

// TODO: derive from thresholds against `matchmaker_stats` once that table is real.
export const MOCK_BADGES: MatchmakerBadge[] = [
  { id: "1", label: "Top Matchmaker", tone: "butter", variant: "outline" },
  { id: "2", label: "5 Intros Sent", tone: "plum", variant: "outline" },
  { id: "3", label: "3 Matches Made", tone: "mint", variant: "outline" },
];

// TODO: replace with the count of friendships where can_introduce = true.
export const MOCK_INTRODUCERS_COUNT = 12;

// TODO: replace with a real blocked/hidden users table once it exists.
export const MOCK_BLOCKED_COUNT = 0;

// TODO: replace with `friendships.can_introduce` write + a real privacy settings table.
export const MOCK_PRIVACY_SETTINGS: PrivacySettings = {
  mutualFriendCountVisible: true,
  closeFriendsCanSuggestFreely: true,
  pausedNewIntros: false,
};
