export interface WingFriend {
  id: string;
  name: string;
  imageUri?: string;
}

// Throwaway fixture data until friendships are wired to Supabase.
export const MOCK_FRIENDS: WingFriend[] = [
  { id: "1", name: "Sam Rivera" },
  { id: "2", name: "Priya Nair" },
  { id: "3", name: "Jordan Blake" },
  { id: "4", name: "Maya Chen" },
  { id: "5", name: "Theo Marsh" },
  { id: "6", name: "Ana Sousa" },
  { id: "7", name: "Kai Fischer" },
];
