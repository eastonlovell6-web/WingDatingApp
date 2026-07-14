import { createAdminClient } from "../_shared/adminClient.ts";
import { getCallerId, UnauthorizedError } from "../_shared/verifyCaller.ts";
import { sendPushToUser } from "../_shared/sendExpoPush.ts";
import { formatMessageNotification } from "../_shared/notificationCopy.ts";

Deno.serve(async (req: Request) => {
  try {
    const senderId = await getCallerId(req);
    const { chatId, content } = await req.json();

    if (!chatId || typeof content !== "string" || !content.trim()) {
      return new Response(JSON.stringify({ error: "chatId and content are required" }), { status: 400 });
    }

    const admin = createAdminClient();

    const { data: chat, error: chatError } = await admin
      .from("chats")
      .select("id, introductions ( user_a_id, user_b_id )")
      .eq("id", chatId)
      .maybeSingle();

    if (chatError || !chat) {
      return new Response(JSON.stringify({ error: "Chat not found" }), { status: 404 });
    }

    const intro = chat.introductions as unknown as { user_a_id: string; user_b_id: string };
    if (senderId !== intro.user_a_id && senderId !== intro.user_b_id) {
      return new Response(JSON.stringify({ error: "Not a participant in this chat" }), { status: 403 });
    }

    const { data: message, error: insertError } = await admin
      .from("messages")
      .insert({ chat_id: chatId, sender_id: senderId, content: content.trim() })
      .select("id, created_at")
      .single();

    if (insertError || !message) {
      return new Response(JSON.stringify({ error: insertError?.message ?? "Insert failed" }), { status: 500 });
    }

    // The recipient is whichever of the two matched people did not send this
    // message. `intro` only ever carries user_a_id/user_b_id here — the
    // matchmaker_id column isn't even selected, so the firewall holds by
    // construction, not by a runtime check.
    const recipientId = senderId === intro.user_a_id ? intro.user_b_id : intro.user_a_id;

    const { data: sender } = await admin.from("users").select("name").eq("id", senderId).maybeSingle();
    const senderFirstName = (sender?.name ?? "Someone").split(" ")[0];
    const { title, body } = formatMessageNotification(senderFirstName);

    // Sent unconditionally, every time — no check of the recipient's
    // foreground/app-open state. Gating delivery on presence would make the
    // notification double as a read receipt, which Wing never has.
    //
    // The message is already committed at this point — push delivery is
    // best-effort and must never turn a successful send into a failure
    // response (a client retry on 500 would create a duplicate message).
    try {
      await sendPushToUser(admin, recipientId, title, body, { type: "message", chatId });
    } catch (pushError) {
      console.warn("send-message: push delivery failed", pushError);
    }

    return new Response(
      JSON.stringify({ messageId: message.id, createdAt: message.created_at }),
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: err.message }), { status: 401 });
    }
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
});
