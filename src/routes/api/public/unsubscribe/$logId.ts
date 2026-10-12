import { createFileRoute } from "@tanstack/react-router";

// Public unsubscribe link from campaign emails. GET shows a confirm button
// (so link scanners don't unsubscribe people); POST (also RFC 8058 one-click)
// marks the contact unsubscribed and adds the address to the sender's
// do-not-contact list. Only affects the single log's own contact.

const page = (body: string) =>
  new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:420px;margin:15vh auto;padding:0 20px;text-align:center;color:#222}button{font:inherit;padding:10px 20px;border-radius:8px;border:0;background:#222;color:#fff;cursor:pointer}</style></head><body>${body}</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );

const valid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export const Route = createFileRoute("/api/public/unsubscribe/$logId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!valid(params.logId)) return page("<p>This link is not valid.</p>");
        return page(`<h2>Unsubscribe</h2><p>You won't receive further emails from this sender.</p><form method="post"><button type="submit">Confirm unsubscribe</button></form>`);
      },
      POST: async ({ params }) => {
        if (!valid(params.logId)) return page("<p>This link is not valid.</p>");
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: log } = await supabaseAdmin
            .from("email_logs").select("user_id, contact_id, recipient_email, contacts(email)").eq("id", params.logId).maybeSingle();
          if (log) {
            const email = ((log.contacts as unknown as { email: string } | null)?.email ?? log.recipient_email ?? "").toLowerCase();
            if (log.contact_id) await supabaseAdmin.from("contacts").update({ unsubscribed: true }).eq("id", log.contact_id);
            if (email) {
              await supabaseAdmin.from("suppressions").upsert({ user_id: log.user_id, email, reason: "unsubscribed" }, { onConflict: "user_id,email", ignoreDuplicates: true });
              const { data: same } = await supabaseAdmin.from("contacts").select("id").eq("user_id", log.user_id).ilike("email", email.replace(/[%_\\]/g, "\\$&"));
              const ids = (same ?? []).map((c) => c.id);
              if (ids.length) {
                await supabaseAdmin.from("contacts").update({ unsubscribed: true }).in("id", ids);
                await supabaseAdmin.from("email_logs").update({ status: "skipped", error: "Unsubscribed" }).in("contact_id", ids).eq("status", "queued");
              }
            }
          }
        } catch (err) {
          console.error("Unsubscribe failed:", err);
          return page("<p>Something went wrong. Please reply to the email asking to be removed.</p>");
        }
        return page("<h2>You're unsubscribed</h2><p>You won't receive further emails from this sender.</p>");
      },
    },
  },
});
