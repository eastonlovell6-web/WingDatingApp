import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/**
 * A friendships row's existence represents the underlying contact
 * relationship itself, independent of which side owns can_introduce (see
 * 002_users_friendships_schema.sql) — so "my direct friends" is the union
 * of both directions, not just one.
 */
export async function getDirectFriendIds(admin: SupabaseClient, userId: string): Promise<string[]> {
  const [asUser, asFriend] = await Promise.all([
    admin.from("friendships").select("friend_id").eq("user_id", userId),
    admin.from("friendships").select("user_id").eq("friend_id", userId),
  ]);
  if (asUser.error) throw asUser.error;
  if (asFriend.error) throw asFriend.error;

  const ids = new Set<string>();
  for (const row of asUser.data ?? []) ids.add(row.friend_id);
  for (const row of asFriend.data ?? []) ids.add(row.user_id);
  ids.delete(userId);
  return [...ids];
}

export interface DiscoverCandidate {
  id: string;
  name: string;
  photos: string[];
  mutuals: { id: string; name: string; imageUri?: string }[];
}

/**
 * Friends-of-friends: people connected to one of the caller's direct
 * friends, excluding the caller and anyone already a direct friend.
 * Candidates are filtered to role !== 'wing-somebody' (same convention as
 * getMatchmakerFriends in lib/friendships.ts) and at least one photo — a
 * card with no image isn't a real product state.
 *
 * Pass onlyCandidateId to resolve a single target (discover-person) instead
 * of the whole network (discover-people) — avoids fetching/returning
 * candidates the caller didn't ask about.
 */
export async function getFriendsOfFriends(
  admin: SupabaseClient,
  userId: string,
  directFriendIds: string[],
  onlyCandidateId?: string
): Promise<DiscoverCandidate[]> {
  if (directFriendIds.length === 0) return [];

  const [asUser, asFriend] = await Promise.all([
    admin.from("friendships").select("user_id, friend_id").in("user_id", directFriendIds),
    admin.from("friendships").select("user_id, friend_id").in("friend_id", directFriendIds),
  ]);
  if (asUser.error) throw asUser.error;
  if (asFriend.error) throw asFriend.error;

  const directFriendIdSet = new Set(directFriendIds);
  const viaByCandidateId = new Map<string, Set<string>>();

  function addLink(candidateId: string, viaId: string) {
    if (candidateId === userId || directFriendIdSet.has(candidateId)) return;
    if (!viaByCandidateId.has(candidateId)) viaByCandidateId.set(candidateId, new Set());
    viaByCandidateId.get(candidateId)!.add(viaId);
  }

  for (const row of asUser.data ?? []) addLink(row.friend_id, row.user_id);
  for (const row of asFriend.data ?? []) addLink(row.user_id, row.friend_id);

  let candidateIds = [...viaByCandidateId.keys()];
  if (onlyCandidateId) {
    candidateIds = candidateIds.filter((id) => id === onlyCandidateId);
  }
  if (candidateIds.length === 0) return [];

  const { data: candidateUsers, error: candidateUsersError } = await admin
    .from("users")
    .select("id, name, photos, role")
    .in("id", candidateIds);
  if (candidateUsersError) throw candidateUsersError;

  const survivors = (candidateUsers ?? []).filter(
    (user) => user.role !== "wing-somebody" && (user.photos ?? []).length > 0
  );
  if (survivors.length === 0) return [];

  const viaIds = new Set<string>();
  for (const user of survivors) {
    for (const id of viaByCandidateId.get(user.id) ?? []) viaIds.add(id);
  }

  const { data: viaUsers, error: viaUsersError } = await admin
    .from("users")
    .select("id, name, photos")
    .in("id", [...viaIds]);
  if (viaUsersError) throw viaUsersError;

  const viaUserById = new Map((viaUsers ?? []).map((user) => [user.id, user]));

  return survivors.map((user) => {
    const viaSet = viaByCandidateId.get(user.id) ?? new Set<string>();
    const mutuals = directFriendIds
      .filter((id) => viaSet.has(id))
      .map((id) => {
        const viaUser = viaUserById.get(id);
        return { id, name: viaUser?.name ?? "", imageUri: viaUser?.photos?.[0] ?? undefined };
      });
    return {
      id: user.id,
      name: user.name ?? "",
      photos: user.photos ?? [],
      mutuals,
    };
  });
}
