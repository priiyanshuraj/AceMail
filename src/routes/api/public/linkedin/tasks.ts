import { createFileRoute } from "@tanstack/react-router";

// Runner API for users who host their own LinkedIn automation runner.
// Auth: "Authorization: Bearer acr_..." token created on the LinkedIn page.
async function authUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!/^acr_[0-9a-f]{64}$/.test(token)) return null;
  const { sha256 } = await import("@/server/linkedin.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("linkedin_runner_tokens").select("user_id").eq("token_hash", await sha256(token)).maybeSingle();
  if (!data) return null;
  await supabaseAdmin.from("linkedin_runner_tokens").update({ last_used_at: new Date().toISOString() }).eq("user_id", data.user_id);
  return { userId: data.user_id, db: supabaseAdmin };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/public/linkedin/tasks")({
  server: { handlers: {
    GET: async ({ request }) => {
      const auth = await authUser(request);
      if (!auth) return json({ error: "Invalid runner token" }, 401);
      const { dueTasks } = await import("@/server/linkedin.server");
      const tasks = await dueTasks(auth.db, auth.userId, "runner", 50);
      return json({ tasks: tasks.map((t) => ({ id: t.id, action: t.action, message: t.message, profile_url: t.profile_url, sequence: t.sequence_name })) });
    },
    POST: async ({ request }) => {
      const auth = await authUser(request);
      if (!auth) return json({ error: "Invalid runner token" }, 401);
      const body = (await request.json().catch(() => null)) as { taskId?: string; status?: string; note?: string; replied?: boolean } | null;
      if (!body?.taskId || !/^[0-9a-f-]{36}$/i.test(body.taskId) || !["done", "skipped", "failed", "later"].includes(body.status ?? "")) return json({ error: "Expected taskId and status (done|skipped|failed|later)" }, 400);
      const { data: task } = await auth.db.from("linkedin_tasks").select("id, contact_id").eq("id", body.taskId).eq("user_id", auth.userId).maybeSingle();
      if (!task) return json({ error: "Task not found" }, 404);
      if (body.status === "later") {
        // e.g. message step but the connection isn't accepted yet: try again tomorrow
        await auth.db.from("linkedin_tasks").update({ due_at: new Date(Date.now() + 86400_000).toISOString(), note: typeof body.note === "string" ? body.note.slice(0, 500) : "Retry tomorrow" }).eq("id", task.id);
        return json({ ok: true });
      }
      const { finishTask } = await import("@/server/linkedin.server");
      await finishTask(auth.db, task.id, body.status as "done", typeof body.note === "string" ? body.note : undefined);
      if (body.replied) {
        await auth.db.from("linkedin_tasks").update({ status: "skipped", note: "Replied on LinkedIn", completed_at: new Date().toISOString() }).eq("contact_id", task.contact_id).eq("status", "pending");
        await auth.db.from("email_logs").update({ status: "skipped", error: "Replied on LinkedIn" }).eq("contact_id", task.contact_id).eq("status", "queued");
      }
      return json({ ok: true });
    },
  } },
});
