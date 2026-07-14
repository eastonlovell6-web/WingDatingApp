import { createAdminClient } from "../_shared/adminClient.ts";
import { getCallerId, UnauthorizedError } from "../_shared/verifyCaller.ts";
import { sendPushToUser } from "../_shared/sendExpoPush.ts";
import { formatIntroNudgeNotification } from "../_shared/notificationCopy.ts";

Deno.serve(async (req: Request) => {
  try {
    const callerId = await getCallerId(req);
    const { introId } = await req.json();

    if (!introId) {
      return new Response(JSON.stringify({ error: "introId is required" }), { status: 400 });
    }

    const admin = createAdminClient();

    const { data: intro, error: fetchError } = await admin
      .from("introductions")
      .select("id, matchmaker_id, user_a_id, user_b_id, status")
      .eq("id", introId)
      .maybeSingle();

    if (fetchError || !intro) {
      return new Response(JSON.stringify({ error: "Introduction not found" }), { status: 404 });
    }
    if (callerId !== intro.matchmaker_id) {
      return new Response(JSON.stringify({ error: "Not the matchmaker for this introduction" }), { status: 403 });
    }

    // Whoever hasn't responded yet is who gets nudged.
    let recipientIds: string[];
    if (intro.status === "both_pending") {
      recipientIds = [intro.user_a_id, intro.user_b_id];
    } else if (intro.status === "pending_a") {
      recipientIds = [intro.user_a_id];
    } else if (intro.status === "pending_b") {
      recipientIds = [intro.user_b_id];
    } else {
      return new Response(JSON.stringify({ error: "Nothing left to nudge on this introduction" }), { status: 409 });
    }

    const { data: matchmaker } = await admin
      .from("users")
      .select("name")
      .eq("id", callerId)
      .maybeSingle();
    const matchmakerFirstName = (matchmaker?.name ?? "Someone").split(" ")[0];
    const { title, body } = formatIntroNudgeNotification(matchmakerFirstName);

    await Promise.all(
      recipientIds.map((userId) => sendPushToUser(admin, userId, title, body, { type: "intro", introId }))
    );

    return new Response(JSON.stringify({ nudged: recipientIds }), { status: 200 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: err.message }), { status: 401 });
    }
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
});
