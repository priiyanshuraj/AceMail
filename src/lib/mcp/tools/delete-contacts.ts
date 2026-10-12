import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "delete_contacts",
  title: "Delete contacts",
  description:
    "Permanently remove up to 200 contacts by ID. Sent email history is kept; their unsent queued emails are cancelled. Confirm with the user first.",
  inputSchema: { contact_ids: z.array(z.string().uuid()).min(1).max(200) },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ contact_ids }, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb.from("contacts").delete().in("id", contact_ids).select("id");
    if (error) throw new ToolError(error.message);
    const result = { deleted: data?.length ?? 0 };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});
