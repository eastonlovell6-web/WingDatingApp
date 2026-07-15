export interface Message {
  id: string;
  chatId: string;
  senderId: string; // Supabase auth user id — real data comes from lib/chat.ts's getMessages
  content: string;
  createdAt: string; // ISO
}
