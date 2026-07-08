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
  },
  {
    id: "2",
    personAName: "Diego Alvarez",
    personBName: "Chloe Bennett",
    personBAvatarUri: "https://i.pravatar.cc/300?img=32",
    sentAt: "2026-06-24",
    status: "pending",
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
  },
];
