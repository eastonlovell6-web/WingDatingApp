export interface ProfilePhoto {
  id: string;
  uri: string;
  isMain?: boolean;
}

export interface ProfilePrompt {
  id: string;
  question: string;
  answer: string;
}

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

// TODO: replace with the `users` row + storage bucket lookup for the signed-in user.
export const MOCK_PROFILE_USER = {
  name: "Easton Lovell",
  meta: "22 · BYU · Provo, UT",
  avatarUri: undefined as string | undefined,
};

// TODO: replace with `users.photos[]` once photo upload/storage is wired.
export const MOCK_PHOTOS: ProfilePhoto[] = [
  { id: "1", uri: "https://i.pravatar.cc/400?img=51", isMain: true },
  { id: "2", uri: "https://i.pravatar.cc/400?img=52" },
  { id: "3", uri: "https://i.pravatar.cc/400?img=53" },
  { id: "4", uri: "https://i.pravatar.cc/400?img=54" },
];

// TODO: replace with `users.bio_prompts[]`.
export const MOCK_PROMPTS: ProfilePrompt[] = [
  {
    id: "1",
    question: "A shameless plug for one of my friends",
    answer: "My roommate makes the best breakfast burritos in Provo. Ask about them.",
  },
  {
    id: "2",
    question: "Unpopular opinion",
    answer: "Cereal is a soup.",
  },
];

// TODO: replace with a real `matchmaker_stats` row for the signed-in user.
export const MOCK_MATCHMAKER_STATS = {
  score: 82,
  percentileLabel: "You're in the top 15% of matchmakers this month.",
  introsSent: 6,
  introsAccepted: 4,
};

// TODO: replace with 0 sent-intros count from `matchmaker_stats` to test the empty nudge state for real.
export const MOCK_HAS_SENT_INTROS = true;

// TODO: derive from thresholds against `matchmaker_stats` once that table is real.
export const MOCK_BADGES: MatchmakerBadge[] = [
  { id: "1", label: "Top Matchmaker", tone: "coral", variant: "solid" },
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
