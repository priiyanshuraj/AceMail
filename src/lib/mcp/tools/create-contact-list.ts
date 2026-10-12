import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_contact_list",
  title: "Create contact list",
  description: "Create a new empty contact list.",
  inputSchema: {
    name: z.string().trim().min(1).max(200),
    description: z.string().max(2000).default(""),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ name, description }, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("contact_lists")
      .insert({ name, description, user_id: ctx.getUserId()! })
      .select("id, name, description")
      .single();
    if (error) throw new ToolError(error.message);
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { list: data } };
  },
});
