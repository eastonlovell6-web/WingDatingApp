import { createAdminClient } from "../_shared/adminClient.ts";
import { getCallerId, UnauthorizedError } from "../_shared/verifyCaller.ts";

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
      .select("id, matchmaker_id, status")
      .eq("id", introId)
      .maybeSingle();

    if (fetchError || !intro) {
      return new Response(JSON.stringify({ error: "Introduction not found" }), { status: 404 });
    }
    if (callerId !== intro.matchmaker_id) {
      return new Response(JSON.stringify({ error: "Not the matchmaker for this introduction" }), { status: 403 });
    }
    if (intro.status !== "both_pending" && intro.status !== "pending_a" && intro.status !== "pending_b") {
      return new Response(JSON.stringify({ error: "This introduction is already resolved" }), { status: 409 });
    }

    // Same compare-and-swap guard as respond-to-introduction: if a
    // recipient accepted/passed between our read and this write, the row
    // no longer matches intro.status and the update becomes a no-op.
    const { data: updated, error: updateError } = await admin
      .from("introductions")
      .update({ status: "withdrawn" })
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

    // No notification to either recipient — quiet, like a pass. It simply
    // stops appearing as a pending intro for them.
    return new Response(JSON.stringify({ status: "withdrawn" }), { status: 200 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: err.message }), { status: 401 });
    }
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
});
