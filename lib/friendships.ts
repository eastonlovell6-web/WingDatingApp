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
