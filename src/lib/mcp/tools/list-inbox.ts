import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_inbox",
  title: "List inbox replies",
  description: "Read replies received from contacts (newest first), with snippet and auto-reply flag.",
  inputSchema: {
    unread_only: z.boolean().default(false),
    include_auto_replies: z.boolean().default(true),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).default(0),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ unread_only, include_auto_replies, limit, offset }, ctx) => {
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("inbox_messages")
      .select("id, from_email, from_name, subject, snippet, received_at, is_read, is_auto_reply, campaign_id, contact_id")
      .order("received_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (unread_only) q = q.eq("is_read", false);
    if (!include_auto_replies) q = q.eq("is_auto_reply", false);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const messages = data ?? [];
    return { content: [{ type: "text", text: JSON.stringify(messages) }], structuredContent: { messages } };
  },
});
