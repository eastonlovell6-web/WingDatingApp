import { supabase } from "./supabase";
import { MOCK_PROFILE_USER } from "../components/profile/mockProfile";
import type { WingFriend } from "../components/home/friendsMock";

export interface DiscoverPerson {
  id: string;
  name: string;
  meta: string;
  photos: string[];
  mutuals: WingFriend[];
}

interface DiscoverCandidate {
  id: string;
  name: string;
  photos: string[];
  mutuals: WingFriend[];
}

function withMeta(candidate: DiscoverCandidate): DiscoverPerson {
  return { ...candidate, meta: MOCK_PROFILE_USER.meta };
}

export async function getDiscoverPeople(): Promise<DiscoverPerson[]> {
  const { data, error } = await supabase.functions.invoke<{ people: DiscoverCandidate[] }>(
    "discover-people"
  );
  if (error) throw error;
  return (data?.people ?? []).map(withMeta);
}

export async function getDiscoverPersonDetail(targetId: string): Promise<DiscoverPerson | null> {
  const { data, error } = await supabase.functions.invoke<{ person: DiscoverCandidate | null }>(
    "discover-person",
    { body: { targetId } }
  );
  if (error) throw error;
  return data?.person ? withMeta(data.person) : null;
}
