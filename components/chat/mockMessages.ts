export interface Message {
  id: string;
  chatId: string;
  senderId: "me" | "them";
  content: string;
  createdAt: string; // ISO
}

// Throwaway fixture data until messages are wired to Supabase. Keyed by
// ChatPreview.id from components/chats/mockChats.ts.
export const MOCK_MESSAGES: Record<string, Message[]> = {
  "1": [
    { id: "m1", chatId: "1", senderId: "them", content: "Hey! So glad Jordan put us together", createdAt: iso(-5) },
    { id: "m2", chatId: "1", senderId: "me", content: "Same, I've been meaning to try that taco place forever", createdAt: iso(-4) },
    { id: "m3", chatId: "1", senderId: "them", content: "Okay that settles it, we HAVE to go to that taco place this weekend", createdAt: iso(-2) },
  ],
  "2": [
    { id: "m4", chatId: "2", senderId: "me", content: "Wait, you actually know that band?", createdAt: iso(-30) },
    { id: "m5", chatId: "2", senderId: "them", content: "Haha yes exactly, I still can't believe you've heard of that band", createdAt: iso(-26) },
  ],
  "3": [
    { id: "m6", chatId: "3", senderId: "them", content: "Sounds good, talk soon!", createdAt: iso(-96) },
  ],
};

function iso(hoursAgo: number): string {
  return new Date(Date.now() + hoursAgo * 60 * 60 * 1000).toISOString();
}
