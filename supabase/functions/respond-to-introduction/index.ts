import { createAdminClient } from "../_shared/adminClient.ts";
import { getCallerId, UnauthorizedError } from "../_shared/verifyCaller.ts";
import { sendPushToUser } from "../_shared/sendExpoPush.ts";
import { formatIntroAcceptedNotification } from "../_shared/notificationCopy.ts";

Deno.serve(async (req: Request) => {
  try {
    const callerId = await getCallerId(req);
    const { introId, response } = await req.json();

    if (!introId || (response !== "accept" && response !== "pass")) {
      return new Response(
        JSON.stringify({ error: "introId and response ('accept'|'pass') are required" }),
        { status: 400 }
      );
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
    if (callerId !== intro.user_a_id && callerId !== intro.user_b_id) {
      return new Response(JSON.stringify({ error: "Not a participant in this introduction" }), { status: 403 });
    }
    if (intro.status === "accepted" || intro.status === "passed" || intro.status === "withdrawn") {
      return new Response(JSON.stringify({ error: "This introduction is already resolved" }), { status: 409 });
    }

    const isUserA = callerId === intro.user_a_id;

    if (response === "pass") {
      // Guard the write with the status we just read (`.eq("status", ...)`)
      // so a concurrent response from the other participant can't be
      // silently clobbered — see the accept branch below for why this
      // matters more there. If nothing matched, the row moved between our
      // read and write; fail closed and let the caller retry against the
      // now-current state.
      const { data: updated, error: updateError } = await admin
        .from("introductions")
        .update({ status: "passed" })
        .eq("id", introId)
        .eq("status", intro.status)
        .select("id")
        .maybeSingle();
      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
      }
      if (!updated) {
        return new Response(JSON.stringify({ error: "This introduction changed — try again" }), { status: 409 });
      }
      // Silent rejection: no notification to anyone, ever.
      return new Response(JSON.stringify({ status: "passed" }), { status: 200 });
    }

    let newStatus: "pending_a" | "pending_b" | "accepted";
    if (intro.status === "both_pending") {
      newStatus = isUserA ? "pending_b" : "pending_a";
    } else if (intro.status === "pending_a" && isUserA) {
      newStatus = "accepted";
    } else if (intro.status === "pending_b" && !isUserA) {
      newStatus = "accepted";
    } else {
      return new Response(JSON.stringify({ error: "You've already responded to this introduction" }), { status: 409 });
    }

    // Same compare-and-swap guard as the pass branch. Without it, two
    // participants accepting at the same instant can both read
    // "both_pending", independently compute "pending_b" and "pending_a",
    // and whichever write lands last silently overwrites the other —
    // leaving the row on a pending status forever with neither accept
    // recorded, so the matchmaker never gets notified even though both
    // people genuinely accepted. Guarding the update on the status we read
    // makes the loser's write a no-op (`updated` is null) instead of a
    // silent overwrite; the loser gets a 409 and their client retries,
    // which reads the now-current status and computes the correct
    // transition.
    const { data: updated, error: updateError } = await admin
      .from("introductions")
      .update({ status: newStatus })
      .eq("id", introId)
      .eq("status", intro.status)
      .select("id")
      .maybeSingle();
    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
    }
    if (!updated) {
      return new Response(JSON.stringify({ error: "This introduction changed — try again" }), { status: 409 });
    }

    if (newStatus === "accepted") {
      const { title, body } = formatIntroAcceptedNotification();
      // The status is already committed at this point — push delivery is
      // best-effort and must never turn a successful status update into a
      // failure response.
      try {
        await sendPushToUser(admin, intro.matchmaker_id, title, body, { type: "intro_accepted" });
      } catch (pushError) {
        console.warn("respond-to-introduction: push delivery failed", pushError);
      }
    }

    return new Response(JSON.stringify({ status: newStatus }), { status: 200 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: err.message }), { status: 401 });
    }
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
});
