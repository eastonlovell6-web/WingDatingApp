import { createAdminClient } from "../_shared/adminClient.ts";
import { getCallerId, UnauthorizedError } from "../_shared/verifyCaller.ts";
import { sendPushToUser } from "../_shared/sendExpoPush.ts";
import { formatIntroNotification } from "../_shared/notificationCopy.ts";

Deno.serve(async (req: Request) => {
  try {
    const matchmakerId = await getCallerId(req);
    const { userAId, userBId, note } = await req.json();

    if (!userAId || !userBId || typeof note !== "string" || !note.trim()) {
      return new Response(
        JSON.stringify({ error: "userAId, userBId, and note are required" }),
        { status: 400 }
      );
    }
    if (userAId === userBId) {
      return new Response(
        JSON.stringify({ error: "userAId and userBId must be different" }),
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: intro, error: insertError } = await admin
      .from("introductions")
      .insert({
        matchmaker_id: matchmakerId,
        user_a_id: userAId,
        user_b_id: userBId,
        note: note.trim(),
        status: "both_pending",
      })
      .select("id")
      .single();

    if (insertError || !intro) {
      return new Response(JSON.stringify({ error: insertError?.message ?? "Insert failed" }), { status: 500 });
    }

    const { data: matchmaker } = await admin
      .from("users")
      .select("name")
      .eq("id", matchmakerId)
      .maybeSingle();
    const matchmakerFirstName = (matchmaker?.name ?? "Someone").split(" ")[0];
    const { title, body } = formatIntroNotification(matchmakerFirstName);

    try {
      await Promise.all([
        sendPushToUser(admin, userAId, title, body, { type: "intro", introId: intro.id }),
        sendPushToUser(admin, userBId, title, body, { type: "intro", introId: intro.id }),
      ]);
    } catch (pushError) {
      console.warn("send-introduction: push delivery failed", pushError);
    }

    return new Response(JSON.stringify({ introId: intro.id }), { status: 200 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: err.message }), { status: 401 });
    }
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
});
