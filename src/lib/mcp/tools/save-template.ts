import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { spamCheck } from "@/lib/deliverability";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "save_template",
  title: "Create or update template",
  description:
    "Create a template (omit template_id) or update one. Body is HTML; use {{field}} variables and {a|b} spintax. Returns a spam score.",
  inputSchema: {
    template_id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(200).optional(),
    subject: z.string().max(500).optional(),
    body: z.string().max(200000).optional(),
    attach_signature: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ template_id, name, subject, body, attach_signature }, ctx) => {
    const sb = supabaseForUser(ctx);
    const patch = {
      ...(name !== undefined ? { name } : {}),
      ...(subject !== undefined ? { subject } : {}),
      ...(body !== undefined ? { body } : {}),
      ...(attach_signature !== undefined ? { attach_signature } : {}),
    };
    let row;
    if (template_id) {
      const { data, error } = await sb
        .from("email_templates")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", template_id)
        .select("id, name, subject, body")
        .maybeSingle();
      if (error) throw new ToolError(error.message);
      if (!data) throw new ToolError("Template not found");
      row = data;
    } else {
      if (!name) throw new ToolError("name is required to create a template");
      const { data, error } = await sb
        .from("email_templates")
        .insert({ ...patch, name, user_id: ctx.getUserId()! })
        .select("id, name, subject, body")
        .single();
      if (error) throw new ToolError(error.message);
      row = data;
    }
    const spam = spamCheck(row.subject, row.body);
    const result = { id: row.id, name: row.name, spam_score: spam.score, spam_issues: spam.issues };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});
