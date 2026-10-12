import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "add_contacts",
  title: "Add contacts",
  description:
    "Add up to 500 contacts to a list. Emails already in the list are skipped. Extra fields become custom fields usable as {{field}}.",
  inputSchema: {
    list_id: z.string().uuid(),
    contacts: z
      .array(
        z.object({
          email: z.string().trim().email(),
          first_name: z.string().max(200).default(""),
          last_name: z.string().max(200).default(""),
          company: z.string().max(300).default(""),
          custom_fields: z.record(z.string().min(1).max(100), z.string().max(5000)).default({}),
        }),
      )
      .min(1)
      .max(500),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ list_id, contacts }, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data: list, error: le } = await sb.from("contact_lists").select("id").eq("id", list_id).maybeSingle();
    if (le) throw new ToolError(le.message);
    if (!list) throw new ToolError("Contact list not found");
    const existing = new Set<string>();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from("contacts").select("email").eq("list_id", list_id).range(from, from + 999);
      if (error) throw new ToolError(error.message);
      (data ?? []).forEach((c) => existing.add(c.email.toLowerCase()));
      if (!data || data.length < 1000) break;
    }
    const userId = ctx.getUserId()!;
    const rows = [];
    let skipped = 0;
    for (const c of contacts) {
      const email = c.email.toLowerCase();
      if (existing.has(email)) { skipped++; continue; }
      existing.add(email);
      rows.push({ list_id, user_id: userId, email, first_name: c.first_name, last_name: c.last_name, company: c.company, custom_fields: c.custom_fields });
    }
    if (rows.length) {
      const { error } = await sb.from("contacts").insert(rows);
      if (error) throw new ToolError(error.message);
    }
    const result = { added: rows.length, skipped_duplicates: skipped };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});
