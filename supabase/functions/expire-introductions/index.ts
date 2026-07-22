import { createAdminClient } from "../_shared/adminClient.ts";

// Invoked by a Supabase Dashboard Cron Job (Project > Integrations > Cron
// Jobs), not by a signed-in user — unlike every other function here, there's
// no getCallerId/UnauthorizedError because there's no acting user. The
// platform's own JWT verification (enabled by default) is satisfied by the
// Cron Job passing the project's service role key as its Authorization
// bearer token; only whoever holds that key can trigger this, the same
// trust level createAdminClient() already assumes everywhere else.
Deno.serve(async (_req: Request) => {
  try {
    const admin = createAdminClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await admin
      .from("introductions")
      .update({ status: "expired" })
      .in("status", ["both_pending", "pending_a", "pending_b"])
      .lt("created_at", sevenDaysAgo)
      .select("id");

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ expired: data?.length ?? 0 }), { status: 200 });
  } catch (err) {
    console.warn("expire-introductions: unexpected error", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500 });
  }
});
