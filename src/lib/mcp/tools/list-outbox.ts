import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_outbox",
  title: "List sent and queued emails",
  description: "Read email send log (queued, sent, opened, replied, bounced, failed) with recipient and timestamps.",
  inputSchema: {
    status: z.enum(["queued", "sent", "opened", "replied", "bounced", "failed", "cancelled"]).optional(),
    campaign_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).default(0),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, campaign_id, limit, offset }, ctx) => {
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("email_logs")
      .select("id, status, campaign_id, recipient_email, direct_to, direct_subject, scheduled_at, sent_at, opened_at, replied_at, bounced_at, error, contacts(email)")
      .order("scheduled_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (status) q = q.eq("status", status);
    if (campaign_id) q = q.eq("campaign_id", campaign_id);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const emails = (data ?? []).map(({ contacts, ...l }) => ({
      ...l,
      to: (contacts as { email: string } | null)?.email ?? l.recipient_email ?? l.direct_to,
    }));
    return { content: [{ type: "text", text: JSON.stringify(emails) }], structuredContent: { emails } };
  },
});
