import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export const listCrmOrganizations = defineTool({
  name: "list_crm_organizations",
  title: "List CRM Organizations",
  description: "List company/organization accounts with industry, employee count, and website.",
  inputSchema: {
    search: z.string().optional(),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId?.() ?? (await sb.auth.getUser()).data.user?.id;
    if (!userId) throw new ToolError("Unauthenticated");

    let q = sb.from("crm_organizations").select("*").eq("user_id", userId).order("name");
    if (args.search) q = q.ilike("name", `%${args.search}%`);

    const { data, error } = await q.limit(args.limit);
    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { organizations: data ?? [] },
    };
  },
});

export const manageCrmOrganizations = defineTool({
  name: "manage_crm_organizations",
  title: "Manage CRM Organizations",
  description: "Create, update, or delete organization/company accounts.",
  inputSchema: {
    action: z.enum(["create", "update", "delete"]),
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(300).optional(),
    website: z.string().max(500).optional(),
    phone: z.string().max(50).optional(),
    address: z.string().max(500).optional(),
    city: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
    industry: z.string().max(100).optional(),
    description: z.string().max(5000).optional(),
    employee_count: z.number().int().min(0).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId?.() ?? (await sb.auth.getUser()).data.user?.id;
    if (!userId) throw new ToolError("Unauthenticated");

    if (args.action === "create") {
      if (!args.name) throw new ToolError("Organization name is required");
      const { data, error } = await sb
        .from("crm_organizations")
        .insert({
          user_id: userId,
          name: args.name,
          website: args.website ?? null,
          phone: args.phone ?? null,
          address: args.address ?? null,
          city: args.city ?? null,
          country: args.country ?? null,
          industry: args.industry ?? null,
          description: args.description ?? null,
          employee_count: args.employee_count ?? null,
        })
        .select()
        .single();
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Created organization "${args.name}" (${data.id})` }], structuredContent: { organization: data } };
    }

    if (args.action === "update") {
      if (!args.id) throw new ToolError("Organization ID is required");
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const [k, v] of Object.entries(args)) {
        if (k !== "action" && k !== "id" && v !== undefined) patch[k] = v;
      }
      const { data, error } = await sb.from("crm_organizations").update(patch).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Updated organization ${args.id}` }], structuredContent: { organization: data } };
    }

    if (args.action === "delete") {
      if (!args.id) throw new ToolError("Organization ID is required");
      const { error } = await sb.from("crm_organizations").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Deleted organization ${args.id}` }], structuredContent: { ok: true } };
    }

    throw new ToolError("Unknown action");
  },
});
