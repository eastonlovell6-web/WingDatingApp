import { createAdminClient } from "../_shared/adminClient.ts";
import { getCallerId, UnauthorizedError } from "../_shared/verifyCaller.ts";
import { getDirectFriendIds } from "../_shared/friendGraph.ts";

Deno.serve(async (req: Request) => {
  try {
    const callerId = await getCallerId(req);
    const admin = createAdminClient();

    const friendIds = await getDirectFriendIds(admin, callerId);
    const ids = [callerId, ...friendIds];

    const [introsResult, usersResult] = await Promise.all([
      admin
        .from("introductions")
        .select("matchmaker_id, status")
        .in("matchmaker_id", ids)
        .neq("status", "withdrawn"),
      admin.from("users").select("id, name, photos").in("id", ids),
    ]);
    if (introsResult.error) throw introsResult.error;
    if (usersResult.error) throw usersResult.error;

    const statsById = new Map<string, { introsSent: number; introsAccepted: number }>();
    for (const id of ids) statsById.set(id, { introsSent: 0, introsAccepted: 0 });
    for (const row of introsResult.data ?? []) {
      const stats = statsById.get(row.matchmaker_id);
      if (!stats) continue;
      stats.introsSent += 1;
      if (row.status === "accepted") stats.introsAccepted += 1;
    }

    const entries = (usersResult.data ?? []).map((user) => ({
      id: user.id,
      name: user.name ?? "",
      avatarUri: user.photos?.[0] ?? undefined,
      ...statsById.get(user.id)!,
    }));

    return new Response(JSON.stringify({ entries }), { status: 200 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: err.message }), { status: 401 });
    }
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
});
