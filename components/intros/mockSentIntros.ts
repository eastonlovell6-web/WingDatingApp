export interface SentIntro {
  id: string;
  personAName: string;
  personAAvatarUri?: string;
  personBName: string;
  personBAvatarUri?: string;
  sentAt: string; // ISO date
  // Only ever 'pending' | 'matched' — the matchmaker firewall means a pass
  // must never surface as its own state. A declined intro simply stays
  // 'pending' forever, so there is no 'declined' value to accidentally render.
  status: "pending" | "matched";
  // The note the matchmaker wrote in the send flow (Matchmaker Step 2).
  // Shown back to them only — the matchmaker firewall still blocks any
  // post-send status/chat visibility.
  note: string;
}
