import { createAdminClient } from "../_shared/adminClient.ts";
import { getCallerId, UnauthorizedError } from "../_shared/verifyCaller.ts";
import { getDirectFriendIds, getFriendsOfFriends } from "../_shared/friendGraph.ts";

Deno.serve(async (req: Request) => {
  try {
    const callerId = await getCallerId(req);
    const { targetId } = await req.json();
    if (!targetId) {
      return new Response(JSON.stringify({ error: "targetId is required" }), { status: 400 });
    }

    const admin = createAdminClient();
    const directFriendIds = await getDirectFriendIds(admin, callerId);
    const [person] = await getFriendsOfFriends(admin, callerId, directFriendIds, targetId);

    return new Response(JSON.stringify({ person: person ?? null }), { status: 200 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: err.message }), { status: 401 });
    }
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
});
