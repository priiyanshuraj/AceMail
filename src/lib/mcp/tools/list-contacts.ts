import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_contacts",
  title: "List contacts",
  description:
    "Read contacts in a contact list, including all custom fields (CSV columns). Paginate with offset.",
  inputSchema: {
    list_id: z.string().uuid().describe("Contact list ID from list_contact_lists."),
    limit: z.number().int().min(1).max(200).default(50).describe("Rows per page (max 200)."),
    offset: z.number().int().min(0).default(0).describe("Rows to skip."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ list_id, limit, offset }, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data, error, count } = await sb
      .from("contacts")
      .select("id, email, first_name, last_name, company, email_status, unsubscribed, custom_fields", {
        count: "exact",
      })
      .eq("list_id", list_id)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw new ToolError(error.message);
    const contacts = (data ?? []).map((c) => ({
      id: c.id,
      email: c.email,
      first_name: c.first_name,
      last_name: c.last_name,
      company: c.company,
      email_status: c.email_status,
      unsubscribed: c.unsubscribed,
      custom_fields:
        c.custom_fields && typeof c.custom_fields === "object" && !Array.isArray(c.custom_fields)
          ? Object.fromEntries(Object.entries(c.custom_fields).map(([k, v]) => [k, v == null ? "" : String(v)]))
          : {},
    }));
    const result = { total: count ?? 0, offset, limit, contacts };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});
