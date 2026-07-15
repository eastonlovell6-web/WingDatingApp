export interface ChatPreview {
  id: string;
  matchName: string;
  matchAvatarUri?: string;
  lastMessage: string;
  lastMessageAt: string; // ISO
  introducedByName: string;
  unreadCount: number;
}

// Real data comes from lib/chat.ts's getChats.
