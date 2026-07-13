import { createAdminClient } from "../_shared/adminClient.ts";
import { getCallerId, UnauthorizedError } from "../_shared/verifyCaller.ts";
import { sendPushToUser } from "../_shared/sendExpoPush.ts";
import { formatIntroRequestNotification } from "../_shared/notificationCopy.ts";

Deno.serve(async (req: Request) => {
  try {
    const requesterId = await getCallerId(req);
    const { targetId, mutualFriendId } = await req.json();

    if (!targetId || !mutualFriendId) {
      return new Response(
        JSON.stringify({ error: "targetId and mutualFriendId are required" }),
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: request, error: insertError } = await admin
      .from("intro_requests")
      .insert({
        requester_id: requesterId,
        target_id: targetId,
        mutual_friend_id: mutualFriendId,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !request) {
      return new Response(JSON.stringify({ error: insertError?.message ?? "Insert failed" }), { status: 500 });
    }

    const { data: requester } = await admin
      .from("users")
      .select("name")
      .eq("id", requesterId)
      .maybeSingle();
    const requesterFirstName = (requester?.name ?? "Someone").split(" ")[0];
    const { title, body } = formatIntroRequestNotification(requesterFirstName);

    // The intro_requests row is already committed at this point — push
    // delivery is best-effort and must never turn a successful write into a
    // failure response (a client retry on 500 would create a duplicate
    // request row).
    try {
      await sendPushToUser(admin, mutualFriendId, title, body, { type: "intro_request" });
    } catch (pushError) {
      console.warn("request-introduction: push delivery failed", pushError);
    }

    return new Response(JSON.stringify({ requestId: request.id }), { status: 200 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: err.message }), { status: 401 });
    }
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
});
