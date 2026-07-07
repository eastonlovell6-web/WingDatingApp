export interface IntroPreview {
  id: string;
  matchmakerName: string;
  note: string;
  matchAvatarName: string;
  matchAvatarUri?: string;
}

// Throwaway fixture data until introductions are wired to Supabase.
export const MOCK_INTROS: IntroPreview[] = [
  {
    id: "1",
    matchmakerName: "Maya",
    note: "You two would click. Both obsessed with the same weird 80s bands.",
    matchAvatarName: "Sam Rivera",
    matchAvatarUri: "https://i.pravatar.cc/300?img=12",
  },
  {
    id: "2",
    matchmakerName: "Jordan",
    note: "Trust me on this one. Same sense of humor, same taste in tacos.",
    matchAvatarName: "Priya Nair",
    matchAvatarUri: "https://i.pravatar.cc/300?img=47",
  },
];
