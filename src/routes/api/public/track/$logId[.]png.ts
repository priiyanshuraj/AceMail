import { createFileRoute } from "@tanstack/react-router";

// 1x1 transparent GIF open-tracking pixel. Public by necessity (email clients
// load it without credentials); it only flips a log row to "opened" and
// reveals nothing.

const PIXEL = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
  (c) => c.charCodeAt(0)
);

export const Route = createFileRoute("/api/public/track/$logId.png")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const logId = params["logId.png"].replace(/\.png$/, "");
        if (/^[0-9a-f-]{36}$/i.test(logId)) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin
              .from("email_logs")
              .update({ status: "opened", opened_at: new Date().toISOString() })
              .eq("id", logId)
              .eq("status", "sent");
          } catch (err) {
            console.error("Tracking pixel update failed:", err);
          }
        }
        return new Response(PIXEL, {
          headers: {
            "Content-Type": "image/gif",
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        });
      },
    },
  },
});
