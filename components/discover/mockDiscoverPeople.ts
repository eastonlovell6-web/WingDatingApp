export interface DiscoverPerson {
  id: string;
  name: string;
  meta: string;
  photos: string[];
  // ids into components/home/friendsMock.ts's MOCK_FRIENDS — which of the
  // viewer's own friends connect them to this person.
  mutualFriendIds: string[];
  // Same semantics as FriendProfile's flag: false = not open to being set
  // up right now. Gates whether this person can ever appear in Discover at
  // all, enforced by getDiscoverPeople() below, not just visually.
  lookingToGetSetUp: boolean;
}

// Throwaway fixture data until friends-of-friends are wired to Supabase.
// IDs are distinct from the viewer's own friends ("1"-"7" in friendsMock.ts/
// mockMatchmakerFriends.ts/mockFriendProfiles.ts) — Discover never shows
// people already in the viewer's friend list.
export const MOCK_DISCOVER_PEOPLE: DiscoverPerson[] = [
  {
    id: "d1",
    name: "Elena Cho",
    meta: "24 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=15"],
    mutualFriendIds: ["1"],
    lookingToGetSetUp: true,
  },
  {
    id: "d2",
    name: "Marcus Webb",
    meta: "25 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=25"],
    mutualFriendIds: ["2", "3"],
    lookingToGetSetUp: true,
  },
  {
    id: "d3",
    name: "Grace Kim",
    meta: "23 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=35"],
    mutualFriendIds: ["4"],
    lookingToGetSetUp: true,
  },
  {
    id: "d4",
    name: "Owen Bryant",
    meta: "24 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=55"],
    mutualFriendIds: ["5", "6", "7"],
    lookingToGetSetUp: true,
  },
  {
    id: "d5",
    name: "Talia Ross",
    meta: "22 · BYU · Provo, UT",
    photos: ["https://i.pravatar.cc/400?img=65"],
    // Solely a wingman right now — must never surface as a requestable
    // target. Exercises the getDiscoverPeople() filter below.
    mutualFriendIds: ["3"],
    lookingToGetSetUp: false,
  },
];

export function getDiscoverPeople(): DiscoverPerson[] {
  return MOCK_DISCOVER_PEOPLE.filter((person) => person.lookingToGetSetUp);
}
