import { supabase } from "./supabase";
import type { MatchmakerFriend } from "../components/matchmaker/mockMatchmakerFriends";

const ACTIVE_INTRO_STATUSES = ["pending_a", "pending_b", "both_pending"];

/**
 * A friendships row's user_id is the friend who granted permission;
 * friend_id is the person allowed to introduce them. So "my friends, with
 * each one's can_introduce setting toward me" is every row where
 * friend_id = the current user.
 */
export async function getMatchmakerFriends(userId: string): Promise<MatchmakerFriend[]> {
  const { data: friendshipRows, error: friendshipsError } = await supabase
    .from("friendships")
    .select("user_id, can_introduce")
    .eq("friend_id", userId);
  if (friendshipsError) throw friendshipsError;

  const friendIds: string[] = (friendshipRows ?? []).map((row) => row.user_id);
  if (friendIds.length === 0) return [];

  const canIntroduceByFriendId = new Map<string, boolean>(
    (friendshipRows ?? []).map((row) => [row.user_id, row.can_introduce])
  );

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, name, photos, role")
    .in("id", friendIds);
  if (usersError) throw usersError;

  // Mirrors supabase/functions/send-introduction/index.ts's countActivePending:
  // two separate queries summed, rather than a single .or() filter.
  const [asA, asB] = await Promise.all([
    supabase
      .from("introductions")
      .select("user_a_id")
      .in("status", ACTIVE_INTRO_STATUSES)
      .in("user_a_id", friendIds),
    supabase
      .from("introductions")
      .select("user_b_id")
      .in("status", ACTIVE_INTRO_STATUSES)
      .in("user_b_id", friendIds),
  ]);
  if (asA.error) throw asA.error;
  if (asB.error) throw asB.error;

  const activePendingCountByFriendId = new Map<string, number>();
  for (const row of asA.data ?? []) {
    activePendingCountByFriendId.set(
      row.user_a_id,
      (activePendingCountByFriendId.get(row.user_a_id) ?? 0) + 1
    );
  }
  for (const row of asB.data ?? []) {
    activePendingCountByFriendId.set(
      row.user_b_id,
      (activePendingCountByFriendId.get(row.user_b_id) ?? 0) + 1
    );
  }

  return (users ?? []).map((user) => ({
    id: user.id,
    name: user.name,
    imageUri: user.photos?.[0] ?? undefined,
    canIntroduce: canIntroduceByFriendId.get(user.id) ?? false,
    activePendingCount: activePendingCountByFriendId.get(user.id) ?? 0,
    lookingToGetSetUp: user.role !== "wing-somebody",
  }));
}

/**
 * The wingman's introducible friends for the daily-prompt flow — friends
 * who've opted this user in to introduce them. Reordered elsewhere by
 * keyword match, never filtered further here (lookingToGetSetUp / pending
 * cap are re-checked downstream by getFriendEligibility when the picked
 * friend lands on Matchmaker Step 1 via ?preselect=).
 */
export async function getIntroducibleFriends(userId: string): Promise<MatchmakerFriend[]> {
  const friends = await getMatchmakerFriends(userId);
  return friends.filter((friend) => friend.canIntroduce);
}

export interface FriendProfileData {
  id: string;
  name: string;
  photos: string[];
  prompts: { question: string; answer: string }[];
  lookingToGetSetUp: boolean;
}

/**
 * Single friend's profile for the read-only Friend Profile screen. Relies
 * on the `users_select_self_or_friend` RLS policy (friendships.ts's own
 * getMatchmakerFriends comment above) rather than checking the friendship
 * graph itself — a non-friend id just comes back null, same trust pattern
 * as getIntroductionDetail in lib/introductions.ts.
 */
export async function getFriendProfile(friendId: string): Promise<FriendProfileData | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, photos, bio_prompts, role")
    .eq("id", friendId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    name: data.name ?? "",
    photos: data.photos ?? [],
    prompts: (data.bio_prompts ?? []) as { question: string; answer: string }[],
    lookingToGetSetUp: data.role !== "wing-somebody",
  };
}

/**
 * Count of friends who can introduce this user. A friendships row's
 * user_id is the friend who granted permission, friend_id is the person
 * allowed to introduce them (see getMatchmakerFriends above) — so rows
 * where user_id = userId are the ones this user granted, and counting
 * those with can_introduce = true gives the number of friends allowed to
 * introduce this user.
 */
export async function getIntroducersCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("friendships")
    .select("friend_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("can_introduce", true);
  if (error) throw error;
  return count ?? 0;
}

const NEW_FRIEND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface FriendVisibilityEntry {
  id: string;
  name: string;
  imageUri?: string;
  canIntroduce: boolean;
  createdAt: string;
  isNew: boolean;
}

/**
 * The signed-in user's own friendships rows (user_id = userId — the
 * direction that represents "friends I've granted, or could grant,
 * permission to introduce me"; see getMatchmakerFriends above for the
 * opposite direction). Sorted new-first (most recently joined at the top,
 * newest to oldest within that group), then everyone else alphabetically —
 * Friend Visibility Settings screen use.
 */
export async function getFriendVisibilityList(userId: string): Promise<FriendVisibilityEntry[]> {
  const { data: friendshipRows, error: friendshipsError } = await supabase
    .from("friendships")
    .select("friend_id, can_introduce, created_at")
    .eq("user_id", userId);
  if (friendshipsError) throw friendshipsError;

  const friendIds: string[] = (friendshipRows ?? []).map((row) => row.friend_id);
  if (friendIds.length === 0) return [];

  const rowByFriendId = new Map((friendshipRows ?? []).map((row) => [row.friend_id, row]));

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, name, photos")
    .in("id", friendIds);
  if (usersError) throw usersError;

  const now = Date.now();
  const entries: FriendVisibilityEntry[] = (users ?? []).map((user) => {
    const row = rowByFriendId.get(user.id)!;
    return {
      id: user.id,
      name: user.name,
      imageUri: user.photos?.[0] ?? undefined,
      canIntroduce: row.can_introduce,
      createdAt: row.created_at,
      isNew: now - new Date(row.created_at).getTime() < NEW_FRIEND_WINDOW_MS,
    };
  });

  return entries.sort((a, b) => {
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
    if (a.isNew) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return a.name.localeCompare(b.name);
  });
}

/**
 * Toggle whether a single friend can introduce the signed-in user. Requires
 * the friendships_update_own RLS policy
 * (supabase/sql/006_friendships_update_policy.sql) — without it this
 * throws a permission error.
 */
export async function setFriendCanIntroduce(
  userId: string,
  friendId: string,
  canIntroduce: boolean
): Promise<void> {
  const { error } = await supabase
    .from("friendships")
    .update({ can_introduce: canIntroduce })
    .eq("user_id", userId)
    .eq("friend_id", friendId);
  if (error) throw error;
}

/**
 * Bulk version of setFriendCanIntroduce for the Select All / None quick
 * actions on the Friend Visibility Settings screen.
 */
export async function setAllFriendsCanIntroduce(
  userId: string,
  friendIds: string[],
  canIntroduce: boolean
): Promise<void> {
  if (friendIds.length === 0) return;
  const { error } = await supabase
    .from("friendships")
    .update({ can_introduce: canIntroduce })
    .eq("user_id", userId)
    .in("friend_id", friendIds);
  if (error) throw error;
}
