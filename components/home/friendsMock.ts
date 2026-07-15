export interface WingFriend {
  id: string;
  name: string;
  imageUri?: string;
}

// Throwaway fixture data until friendships are wired to Supabase.
// imageUri is each friend's first photo, ids shared 1:1 with
// mockMatchmakerFriends.ts — populated so FriendsRow and WingCardStack show
// real faces instead of falling back to initials.
export const MOCK_FRIENDS: WingFriend[] = [
  { id: "1", name: "Sam Rivera", imageUri: "https://i.pravatar.cc/400?img=11" },
  { id: "2", name: "Priya Nair", imageUri: "https://i.pravatar.cc/400?img=21" },
  { id: "3", name: "Jordan Blake", imageUri: "https://i.pravatar.cc/400?img=31" },
  { id: "4", name: "Maya Chen", imageUri: "https://i.pravatar.cc/400?img=41" },
  { id: "5", name: "Theo Marsh", imageUri: "https://i.pravatar.cc/400?img=51" },
  { id: "6", name: "Ana Sousa", imageUri: "https://i.pravatar.cc/400?img=61" },
  { id: "7", name: "Kai Fischer", imageUri: "https://i.pravatar.cc/400?img=71" },
];
