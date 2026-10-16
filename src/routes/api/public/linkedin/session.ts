import { createFileRoute } from "@tanstack/react-router";

// Cloud worker fetches the user's encrypted-at-rest LinkedIn session using its runner key.
async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!/^acr_[0-9a-f]{64}$/.test(token)) return null;
  const { sha256 } = await import("@/server/linkedin.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("linkedin_runner_tokens").select("user_id").eq("token_hash", await sha256(token)).maybeSingle();
  return data ? { userId: data.user_id, db: supabaseAdmin } : null;
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/public/linkedin/session")({
  server: { handlers: {
    GET: async ({ request }) => {
      const a = await auth(request);
      if (!a) return json({ error: "Invalid runner token" }, 401);
      const { data } = await a.db.from("linkedin_cloud_sessions").select("cookie_enc, proxy_enc").eq("user_id", a.userId).maybeSingle();
      if (!data) return json({ error: "No LinkedIn cookie saved" }, 404);
      const { decryptConnectionKey } = await import("@/server/connectionKeyCrypto");
      return json({ li_at: decryptConnectionKey(data.cookie_enc), proxy: data.proxy_enc ? decryptConnectionKey(data.proxy_enc) : null });
    },
    POST: async ({ request }) => {
      const a = await auth(request);
      if (!a) return json({ error: "Invalid runner token" }, 401);
      const b = (await request.json().catch(() => null)) as { status?: string; note?: string } | null;
      if (!["connected", "expired"].includes(b?.status ?? "")) return json({ error: "status must be connected|expired" }, 400);
      await a.db.from("linkedin_cloud_sessions").update({ status: b!.status!, status_note: b?.note?.slice(0, 300) ?? null, updated_at: new Date().toISOString() }).eq("user_id", a.userId);
      return json({ ok: true });
    },
  } },
});
