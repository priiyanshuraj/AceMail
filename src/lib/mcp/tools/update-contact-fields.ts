import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const STANDARD = ["first_name", "last_name", "company"] as const;

export default defineTool({
  name: "update_contact_fields",
  title: "Update contact fields",
  description:
    "Write values to contacts: set first_name/last_name/company or create/update custom fields (new columns usable as {{field}} in templates). Up to 200 contacts per call.",
  inputSchema: {
    updates: z
      .array(
        z.object({
          contact_id: z.string().uuid(),
          fields: z
            .record(z.string().trim().min(1).max(100), z.string().max(5000))
            .describe("Field name to value. Standard: first_name, last_name, company; anything else becomes a custom field."),
        }),
      )
      .min(1)
      .max(200),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ updates }, ctx) => {
    const sb = supabaseForUser(ctx);
    const ids = updates.map((u) => u.contact_id);
    const { data: existing, error } = await sb.from("contacts").select("id, custom_fields").in("id", ids);
    if (error) throw new ToolError(error.message);
    const byId = new Map((existing ?? []).map((c) => [c.id, c.custom_fields]));
    let updated = 0;
    const failed: { contact_id: string; reason: string }[] = [];
    for (const u of updates) {
      if (!byId.has(u.contact_id)) {
        failed.push({ contact_id: u.contact_id, reason: "Contact not found" });
        continue;
      }
      const prev = byId.get(u.contact_id);
      const custom: Record<string, string> =
        prev && typeof prev === "object" && !Array.isArray(prev)
          ? Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, v == null ? "" : String(v)]))
          : {};
      const patch: { first_name?: string; last_name?: string; company?: string; custom_fields?: Record<string, string> } = {};
      let customChanged = false;
      for (const [k, v] of Object.entries(u.fields)) {
        if ((STANDARD as readonly string[]).includes(k)) patch[k as (typeof STANDARD)[number]] = v;
        else {
          custom[k] = v;
          customChanged = true;
        }
      }
      if (customChanged) patch.custom_fields = custom;
      const { error: upErr } = await sb.from("contacts").update(patch).eq("id", u.contact_id);
      if (upErr) failed.push({ contact_id: u.contact_id, reason: upErr.message });
      else updated++;
    }
    const result = { updated, failed };
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});
