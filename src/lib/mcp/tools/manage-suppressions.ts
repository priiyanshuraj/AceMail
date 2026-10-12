import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "manage_do_not_contact",
  title: "Do-not-contact list",
  description: "List the do-not-contact list, or add emails to it (they will never be emailed by any campaign).",
  inputSchema: {
    add_emails: z.array(z.string().trim().email()).max(500).default([]),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ add_emails }, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId()!;
    if (add_emails.length) {
      const rows = [...new Set(add_emails.map((e) => e.toLowerCase()))].map((email) => ({ user_id: userId, email, reason: "manual" }));
      const { error } = await sb.from("suppressions").upsert(rows, { onConflict: "user_id,email", ignoreDuplicates: true });
      if (error) throw new ToolError(error.message);
    }
    const { data, error } = await sb.from("suppressions").select("email, reason, created_at").order("created_at", { ascending: false }).limit(1000);
    if (error) throw new ToolError(error.message);
    const result = { added: add_emails.length, entries: data ?? [] };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});
