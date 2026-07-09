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

// Throwaway fixture data until sent introductions are wired to Supabase.
export const MOCK_SENT_INTROS: SentIntro[] = [
  {
    id: "1",
    personAName: "Sam Rivera",
    personAAvatarUri: "https://i.pravatar.cc/300?img=12",
    personBName: "Priya Nair",
    personBAvatarUri: "https://i.pravatar.cc/300?img=47",
    sentAt: "2026-07-01",
    status: "matched",
    note: "You two would get along way too well — both terminally online about the same niche hobby.",
  },
  {
    id: "2",
    personAName: "Diego Alvarez",
    personBName: "Chloe Bennett",
    personBAvatarUri: "https://i.pravatar.cc/300?img=32",
    sentAt: "2026-06-24",
    status: "pending",
    note: "Chloe, meet the only person I know who argues about oat milk as passionately as you do.",
  },
  {
    id: "3",
    personAName: "Noah Kim",
    personAAvatarUri: "https://i.pravatar.cc/300?img=18",
    personBName: "Grace Lin",
    sentAt: "2026-06-10",
    // In reality Grace passed — but the matchmaker firewall means this stays
    // "Pending" on screen forever, not "Declined".
    status: "pending",
    note: "Noah, Grace just ran her first half marathon and won't stop talking about it. You two should talk about it together.",
  },
];
