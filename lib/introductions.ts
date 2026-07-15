// lib/introductions.ts
import { supabase } from "./supabase";
import type { SentIntro } from "../components/intros/mockSentIntros";
import type { IntroPreview, IntroDetail } from "../components/intro/mockIntros";
import { MOCK_PROFILE_USER } from "../components/profile/mockProfile";

/**
 * supabase-js's FunctionsHttpError always has a generic .message ("Edge
 * Function returned a non-2xx status code") — the Edge Function's actual
 * JSON error body is only reachable via .context, a raw Response. Shared by
 * every screen that sends through an Edge Function and wants the real
 * server-side error surfaced instead of that generic string.
 */
export async function extractFunctionErrorMessage(err: unknown, fallback: string): Promise<string> {
  if (err && typeof err === "object" && "context" in err) {
    const context = (err as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json();
        if (typeof body?.error === "string") return body.error;
      } catch {
        // Fall through to the fallback below.
      }
    }
  }
  return err instanceof Error ? err.message : fallback;
}

export async function sendIntroduction(userAId: string, userBId: string, note: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ introId: string }>("send-introduction", {
    body: { userAId, userBId, note },
  });
  if (error) throw error;
  return data!.introId;
}

export async function requestIntroduction(targetId: string, mutualFriendId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ requestId: string }>("request-introduction", {
    body: { targetId, mutualFriendId },
  });
  if (error) throw error;
  return data!.requestId;
}

export type IntroResponseResult = "pending_a" | "pending_b" | "accepted" | "passed";

/**
 * respond-to-introduction guards its status update with a compare-and-swap
 * and returns 409 if the row changed between its read and write (e.g. the
 * other participant responded at nearly the same instant). That 409 doesn't
 * mean this response failed — it means the attempt needs to be resubmitted
 * against the now-current status, which is why this retries once before
 * giving up. Without the retry, a genuine simultaneous double-accept could
 * silently fail to notify the matchmaker from the loser's side.
 */
export async function respondToIntroduction(
  introId: string,
  response: "accept" | "pass"
): Promise<IntroResponseResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase.functions.invoke<{ status: IntroResponseResult }>(
      "respond-to-introduction",
      { body: { introId, response } }
    );
    if (!error) {
      return data!.status;
    }
    const isStatusConflict =
      "context" in error && error.context instanceof Response && error.context.status === 409;
    if (!isStatusConflict || attempt === 1) {
      throw error;
    }
  }
  throw new Error("respondToIntroduction: unreachable");
}

export async function withdrawIntroduction(introId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("withdraw-introduction", { body: { introId } });
  if (error) throw error;
}

export async function nudgeIntroduction(introId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("nudge-introduction", { body: { introId } });
  if (error) throw error;
}

/**
 * Two-step fetch (introductions, then users by id) rather than a PostgREST
 * embed, matching getMatchmakerFriends' convention in lib/friendships.ts —
 * introductions has three FKs into users (matchmaker_id/user_a_id/
 * user_b_id), so an embed would need explicit constraint-name hints anyway.
 * Withdrawn intros are excluded — once withdrawn they simply disappear from
 * the matchmaker's sent list, there's no "Withdrawn" UI state to show.
 */
export async function getSentIntroductions(matchmakerId: string): Promise<SentIntro[]> {
  const { data: intros, error } = await supabase
    .from("introductions")
    .select("id, user_a_id, user_b_id, note, status, created_at")
    .eq("matchmaker_id", matchmakerId)
    .neq("status", "withdrawn")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const userIds = Array.from(new Set((intros ?? []).flatMap((i) => [i.user_a_id, i.user_b_id])));
  const { data: users, error: usersError } =
    userIds.length > 0
      ? await supabase.from("users").select("id, name, photos").in("id", userIds)
      : { data: [], error: null };
  if (usersError) throw usersError;

  const userById = new Map((users ?? []).map((u) => [u.id, u]));

  return (intros ?? []).map((intro) => {
    const userA = userById.get(intro.user_a_id);
    const userB = userById.get(intro.user_b_id);
    return {
      id: intro.id,
      personAName: userA?.name ?? "Someone",
      personAAvatarUri: userA?.photos?.[0] ?? undefined,
      personBName: userB?.name ?? "Someone",
      personBAvatarUri: userB?.photos?.[0] ?? undefined,
      sentAt: intro.created_at,
      // Only ever 'pending' | 'matched' — see mockSentIntros.ts's SentIntro
      // comment: the matchmaker firewall means a pass must never surface as
      // its own state, so it stays 'pending' forever.
      status: intro.status === "accepted" ? "matched" : "pending",
      note: intro.note,
    };
  });
}

export interface MatchmakerStats {
  introsSent: number;
  introsAccepted: number;
}

/**
 * Aggregate counts only, per the matchmaker-firewall privacy rule — no
 * status or chat data leaves this function, just two numbers. introsSent
 * excludes withdrawn, matching getSentIntroductions' convention (a
 * withdrawn intro was never "sent").
 */
export async function getMatchmakerStats(matchmakerId: string): Promise<MatchmakerStats> {
  const [sentResult, acceptedResult] = await Promise.all([
    supabase
      .from("introductions")
      .select("id", { count: "exact", head: true })
      .eq("matchmaker_id", matchmakerId)
      .neq("status", "withdrawn"),
    supabase
      .from("introductions")
      .select("id", { count: "exact", head: true })
      .eq("matchmaker_id", matchmakerId)
      .eq("status", "accepted"),
  ]);
  if (sentResult.error) throw sentResult.error;
  if (acceptedResult.error) throw acceptedResult.error;

  return {
    introsSent: sentResult.count ?? 0,
    introsAccepted: acceptedResult.count ?? 0,
  };
}

/**
 * respond-to-introduction's state machine (see that function): both_pending
 * means neither participant has responded; pending_a/pending_b means
 * whichever slot is named still hasn't responded. So "still needs this
 * viewer's action" is both_pending, or pending_<their own slot>.
 */
async function fetchIncomingIntroRows(userId: string) {
  const [asA, asB] = await Promise.all([
    supabase
      .from("introductions")
      .select("id, matchmaker_id, user_b_id, note, created_at")
      .eq("user_a_id", userId)
      .in("status", ["both_pending", "pending_a"]),
    supabase
      .from("introductions")
      .select("id, matchmaker_id, user_a_id, note, created_at")
      .eq("user_b_id", userId)
      .in("status", ["both_pending", "pending_b"]),
  ]);
  if (asA.error) throw asA.error;
  if (asB.error) throw asB.error;

  return [
    ...(asA.data ?? []).map((row) => ({ ...row, otherUserId: row.user_b_id })),
    ...(asB.data ?? []).map((row) => ({ ...row, otherUserId: row.user_a_id })),
  ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

/**
 * Feed-only fields (see IntroPreview in components/intro/mockIntros.ts) —
 * deliberately skips photos/bio_prompts so the Home feed doesn't pull full
 * profile data for every pending intro, just to render an avatar + note.
 */
export async function getIncomingIntroductions(userId: string): Promise<IntroPreview[]> {
  const rows = await fetchIncomingIntroRows(userId);

  const userIds = Array.from(new Set(rows.flatMap((r) => [r.matchmaker_id, r.otherUserId])));
  const { data: users, error: usersError } =
    userIds.length > 0
      ? await supabase.from("users").select("id, name, photos").in("id", userIds)
      : { data: [], error: null };
  if (usersError) throw usersError;
  const userById = new Map((users ?? []).map((u) => [u.id, u]));

  return rows.map((row) => {
    const matchmaker = userById.get(row.matchmaker_id);
    const other = userById.get(row.otherUserId);
    return {
      id: row.id,
      matchmakerName: (matchmaker?.name ?? "Someone").split(" ")[0],
      matchmakerAvatarUri: matchmaker?.photos?.[0] ?? undefined,
      note: row.note,
      matchAvatarName: other?.name ?? "Someone",
      matchAvatarUri: other?.photos?.[0] ?? undefined,
    };
  });
}

/**
 * Single intro's full detail for the /intro/[id] screen. RLS
 * (introductions_select_participant) already restricts the row to its
 * matchmaker/user_a/user_b, so an id the viewer isn't part of just comes
 * back null rather than needing a client-side participant check.
 *
 * matchAge/matchTagline stay mock — `users` has no age or single-line-bio
 * column yet, same known gap MOCK_PROFILE_USER's own TODO already covers
 * for the signed-in user on this same screen.
 */
export async function getIntroductionDetail(introId: string, viewerId: string): Promise<IntroDetail | null> {
  const { data: intro, error } = await supabase
    .from("introductions")
    .select("id, matchmaker_id, user_a_id, user_b_id, note")
    .eq("id", introId)
    .maybeSingle();
  if (error) throw error;
  if (!intro) return null;

  const otherUserId = viewerId === intro.user_a_id ? intro.user_b_id : intro.user_a_id;
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, name, photos, bio_prompts")
    .in("id", Array.from(new Set([intro.matchmaker_id, otherUserId])));
  if (usersError) throw usersError;
  const userById = new Map((users ?? []).map((u) => [u.id, u]));

  const matchmaker = userById.get(intro.matchmaker_id);
  const other = userById.get(otherUserId);

  return {
    id: intro.id,
    matchmakerName: (matchmaker?.name ?? "Someone").split(" ")[0],
    matchmakerAvatarUri: matchmaker?.photos?.[0] ?? undefined,
    note: intro.note,
    matchAvatarName: other?.name ?? "Someone",
    matchAvatarUri: other?.photos?.[0] ?? undefined,
    matchAge: MOCK_PROFILE_USER.age,
    matchTagline: MOCK_PROFILE_USER.tagline,
    matchPhotos: other?.photos ?? [],
    matchPrompts: other?.bio_prompts ?? [],
  };
}
