import type { ProfilePrompt } from "../profile/mockProfile";

export interface IntroPreview {
  id: string;
  matchmakerName: string;
  matchmakerAvatarUri?: string;
  note: string;
  matchAvatarName: string;
  matchAvatarUri?: string;
  matchAge: number;
  matchTagline: string;
  // Additional photos shown in the detail screen's expandable "About" section.
  matchPhotos: string[];
  matchPrompts: ProfilePrompt[];
}

// Throwaway fixture data until introductions are wired to Supabase.
export const MOCK_INTROS: IntroPreview[] = [
  {
    id: "1",
    matchmakerName: "Maya",
    matchmakerAvatarUri: "https://i.pravatar.cc/300?img=32",
    note: "You two would click. Both obsessed with the same weird 80s bands.",
    matchAvatarName: "Sam Rivera",
    matchAvatarUri: "https://i.pravatar.cc/300?img=12",
    matchAge: 23,
    matchTagline: "Vinyl collector, mediocre skateboarder.",
    matchPhotos: [
      "https://i.pravatar.cc/400?img=13",
      "https://i.pravatar.cc/400?img=14",
      "https://i.pravatar.cc/400?img=15",
    ],
    matchPrompts: [
      {
        question: "I could talk for an hour about...",
        answer: "Why the Talking Heads' live album is better than the studio version. Fight me.",
      },
      {
        question: "Ask me about the time I...",
        answer: "Drove six hours to a record store because they had one sealed original pressing.",
      },
    ],
  },
  {
    id: "2",
    matchmakerName: "Jordan",
    matchmakerAvatarUri: "https://i.pravatar.cc/300?img=68",
    note: "Trust me on this one. Same sense of humor, same taste in tacos.",
    matchAvatarName: "Priya Nair",
    matchAvatarUri: "https://i.pravatar.cc/300?img=47",
    matchAge: 24,
    matchTagline: "Will debate you on the best taco truck in town.",
    matchPhotos: [
      "https://i.pravatar.cc/400?img=48",
      "https://i.pravatar.cc/400?img=49",
    ],
    matchPrompts: [
      {
        question: "My friends would describe me in three words as...",
        answer: "Loud, loyal, hungry.",
      },
      {
        question: "I'm weirdly competitive about...",
        answer: "Trivia night. I will not let us lose to the team named 'Quiz Pro Quo' again.",
      },
    ],
  },
];
