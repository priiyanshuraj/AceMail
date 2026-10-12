import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const STATUSES = ["queued", "sent", "opened", "replied", "bounced", "failed", "cancelled"] as const;

export default defineTool({
  name: "get_campaign_stats",
  title: "Campaign stats",
  description: "Email counts by status (queued, sent, opened, replied, bounced, failed, cancelled) for one campaign, or all email if campaign_id is omitted.",
  inputSchema: { campaign_id: z.string().uuid().optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ campaign_id }, ctx) => {
    const sb = supabaseForUser(ctx);
    const counts = { queued: 0, sent: 0, opened: 0, replied: 0, bounced: 0, failed: 0, cancelled: 0 };
    for (const s of STATUSES) {
      let q = sb.from("email_logs").select("id", { count: "exact", head: true }).eq("status", s);
      if (campaign_id) q = q.eq("campaign_id", campaign_id);
      const { count, error } = await q;
      if (error) throw new ToolError(error.message);
      counts[s] = count ?? 0;
    }
    const delivered = counts.sent + counts.opened + counts.replied + counts.bounced;
    const pct = (n: number) => (delivered ? Math.round((n / delivered) * 1000) / 10 : 0);
    const result = { campaign_id: campaign_id ?? null, counts, total_sent: delivered, open_rate_pct: pct(counts.opened + counts.replied), reply_rate_pct: pct(counts.replied), bounce_rate_pct: pct(counts.bounced) };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});
