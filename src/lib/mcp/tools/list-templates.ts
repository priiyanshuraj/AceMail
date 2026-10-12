import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_templates",
  title: "List templates",
  description: "List email templates. Set include_body to also return subject and HTML body.",
  inputSchema: { include_body: z.boolean().default(false) },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_body }, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("email_templates")
      .select("id, name, subject, body, attach_signature, updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new ToolError(error.message);
    const templates = (data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      subject: t.subject,
      attach_signature: t.attach_signature,
      updated_at: t.updated_at,
      ...(include_body ? { body: t.body } : {}),
    }));
    return { content: [{ type: "text", text: JSON.stringify(templates) }], structuredContent: { templates } };
  },
});
