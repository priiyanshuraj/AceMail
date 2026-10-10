import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/click/$linkId")({
  server: { handlers: {
    GET: async ({ params, request }) => {
      if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(params.linkId)) return new Response("Not found", { status: 404 });
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: link } = await supabaseAdmin.from("email_tracking_links").select("id, log_id, user_id, destination").eq("id", params.linkId).maybeSingle();
      if (!link) return new Response("Not found", { status: 404 });
      let destination: URL;
      try { destination = new URL(link.destination); } catch { return new Response("Not found", { status: 404 }); }
      if (!["https:", "http:"].includes(destination.protocol)) return new Response("Not found", { status: 404 });
      const { data: log } = await supabaseAdmin.from("email_logs").select("sent_at").eq("id", link.log_id).eq("user_id", link.user_id).maybeSingle();
      const agent = request.headers.get("user-agent") ?? "";
      const automated = /bot|crawler|spider|preview|scanner/i.test(agent) || request.headers.get("purpose") === "prefetch" || request.headers.get("sec-purpose")?.includes("prefetch");
      if (log?.sent_at && !automated) {
        const { error } = await supabaseAdmin.from("email_click_events").insert({ link_id: link.id, log_id: link.log_id, user_id: link.user_id });
        if (error) console.error("Click tracking failed");
      }
      return new Response(null, { status: 302, headers: { Location: destination.href, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
    },
  } },
});