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
  age: 22,
  // TODO: no single-line bio/tagline column exists yet either — placeholder
  // until that data model exists, same as `meta` above.
  tagline: "Still figuring out if cereal counts as soup.",
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

export interface MatchmakerRankProgress {
  tier: "Wingperson" | "Setup Artist" | "Cupid" | "Matchmaker Legend";
  level: number;
  xpCurrent: number;
  xpForNextLevel: number;
  streakWeeks: number;
  streakAtRisk: boolean;
  streakResetsInDays: number;
}

// TODO: replace with a real blocked/hidden users table once it exists.
export const MOCK_BLOCKED_COUNT = 0;

// TODO: replace with `friendships.can_introduce` write + a real privacy settings table.
export const MOCK_PRIVACY_SETTINGS: PrivacySettings = {
  mutualFriendCountVisible: true,
  closeFriendsCanSuggestFreely: true,
  pausedNewIntros: false,
};
