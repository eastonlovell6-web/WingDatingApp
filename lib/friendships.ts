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
