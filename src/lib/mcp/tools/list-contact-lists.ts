import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_contact_lists",
  title: "List contact lists",
  description: "List your AceMail contact lists (imported CSVs / sheets) with contact counts.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("contact_lists")
      .select("id, name, description, created_at, contacts(count)")
      .order("created_at", { ascending: false });
    if (error) throw new ToolError(error.message);
    const lists = (data ?? []).map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      created_at: l.created_at,
      contact_count: (l.contacts as unknown as { count: number }[])?.[0]?.count ?? 0,
    }));
    return { content: [{ type: "text", text: JSON.stringify(lists) }], structuredContent: { lists } };
  },
});
