import { create } from "zustand";
import { MOCK_SENT_INTROS, type SentIntro } from "../components/intros/mockSentIntros";
import type { MatchmakerFriend } from "../components/matchmaker/mockMatchmakerFriends";

interface IntrosState {
  sentIntros: SentIntro[];
  sendIntro: (friendA: MatchmakerFriend, friendB: MatchmakerFriend, note: string) => void;
}

export const useIntrosStore = create<IntrosState>()((set) => ({
  sentIntros: MOCK_SENT_INTROS,

  sendIntro: (friendA, friendB, note) => {
    const newIntro: SentIntro = {
      id: String(Date.now()),
      personAName: friendA.name,
      personAAvatarUri: friendA.imageUri,
      personBName: friendB.name,
      personBAvatarUri: friendB.imageUri,
      sentAt: new Date().toISOString(),
      status: "pending",
      note,
    };
    set((state) => ({ sentIntros: [newIntro, ...state.sentIntros] }));
  },
}));
