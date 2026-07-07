export interface IntroPreview {
  id: string;
  matchmakerName: string;
  note: string;
  matchAvatarName: string;
  isNew: boolean;
}

// Throwaway fixture data until introductions are wired to Supabase.
export const MOCK_INTROS: IntroPreview[] = [
  {
    id: "1",
    matchmakerName: "Maya",
    note: "You two would click. Both obsessed with the same weird 80s bands.",
    matchAvatarName: "Sam Rivera",
    isNew: true,
  },
  {
    id: "2",
    matchmakerName: "Jordan",
    note: "Trust me on this one. Same sense of humor, same taste in tacos.",
    matchAvatarName: "Priya Nair",
    isNew: true,
  },
];
