import type { ProfilePrompt } from "../profile/mockProfile";

export interface FriendProfile {
  id: string;
  name: string;
  meta: string;
  photos: string[];
  prompts: ProfilePrompt[];
  // Mirrors friendships.can_introduce for this friend — gates the
  // "Introduce [Name] to someone" action.
  canIntroduce: boolean;
  // Mirrors this friend's own visibility setting on being asked about via
  // Request an Intro — gates "See who [Name] could introduce you to".
  connectionsVisible: boolean;
}

// Throwaway fixture data until friend profiles are wired to Supabase. IDs
// and names match components/home/friendsMock.ts and
// components/matchmaker/mockMatchmakerFriends.ts.
export const MOCK_FRIEND_PROFILES: Record<string, FriendProfile> = {
  "1": {
    id: "1",
    name: "Sam Rivera",
    meta: "23 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=11", "https://i.pravatar.cc/400?img=12"],
    prompts: [
      { question: "I will never turn down...", answer: "A pickup game of pickleball, any time of day." },
    ],
    canIntroduce: true,
    connectionsVisible: true,
  },
  "2": {
    id: "2",
    name: "Priya Nair",
    meta: "24 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=21"],
    prompts: [
      {
        question: "The last thing that made me laugh out loud was...",
        answer: "My little sister's audition tape for a cooking show.",
      },
    ],
    canIntroduce: true,
    connectionsVisible: true,
  },
  "3": {
    id: "3",
    name: "Jordan Blake",
    meta: "22 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=31", "https://i.pravatar.cc/400?img=32"],
    prompts: [
      { question: "Ask me about the time I...", answer: "Talked my way onto a closed ski lift in a snowstorm." },
    ],
    canIntroduce: true,
    connectionsVisible: false,
  },
  "4": {
    id: "4",
    name: "Maya Chen",
    meta: "23 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=41"],
    prompts: [
      { question: "I'm weirdly competitive about...", answer: "Trivia night. I keep a running scoreboard on my fridge." },
    ],
    canIntroduce: true,
    connectionsVisible: true,
  },
  "5": {
    id: "5",
    name: "Theo Marsh",
    meta: "25 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=51"],
    prompts: [
      { question: "I could talk for an hour about...", answer: "Why the 1997 Jazz should've won it all." },
    ],
    canIntroduce: false,
    connectionsVisible: true,
  },
  "6": {
    id: "6",
    name: "Ana Sousa",
    meta: "22 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=61", "https://i.pravatar.cc/400?img=62"],
    prompts: [
      {
        question: "My friends would describe me in three words as...",
        answer: "Loud, loyal, chronically late.",
      },
    ],
    canIntroduce: true,
    connectionsVisible: true,
  },
  "7": {
    id: "7",
    name: "Kai Fischer",
    meta: "24 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=71"],
    prompts: [
      {
        question: "A skill I'm proud of that has zero practical use...",
        answer: "I can solve a Rubik's cube behind my back.",
      },
    ],
    canIntroduce: true,
    connectionsVisible: false,
  },
};
