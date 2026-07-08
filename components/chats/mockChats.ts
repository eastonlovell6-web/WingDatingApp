export interface ChatPreview {
  id: string;
  matchName: string;
  matchAvatarUri?: string;
  lastMessage: string;
  lastMessageAt: string; // ISO
  introducedByName: string;
  unread: boolean;
}

// Throwaway fixture data until chats (accepted introductions) are wired to Supabase.
export const MOCK_CHATS: ChatPreview[] = [
  {
    id: "1",
    matchName: "Priya Nair",
    matchAvatarUri: "https://i.pravatar.cc/300?img=47",
    lastMessage: "Okay that settles it, we HAVE to go to that taco place this weekend",
    lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    introducedByName: "Jordan",
    unread: true,
  },
  {
    id: "2",
    matchName: "Sam Rivera",
    matchAvatarUri: "https://i.pravatar.cc/300?img=12",
    lastMessage: "Haha yes exactly, I still can't believe you've heard of that band",
    lastMessageAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    introducedByName: "Maya",
    unread: false,
  },
  {
    id: "3",
    matchName: "Grace Lin",
    lastMessage: "Sounds good, talk soon!",
    lastMessageAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    introducedByName: "Noah",
    unread: false,
  },
];
