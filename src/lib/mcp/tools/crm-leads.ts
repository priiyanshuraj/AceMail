import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export const listCrmLeads = defineTool({
  name: "list_crm_leads",
  title: "List CRM Leads",
  description: "List inbound/outbound leads with their status, source, value, and contact details.",
  inputSchema: {
    status: z.enum(["new", "in_progress", "converted", "lost"]).optional().describe("Filter by lead status"),
    search: z.string().optional().describe("Search term"),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId?.() ?? (await sb.auth.getUser()).data.user?.id;
    if (!userId) throw new ToolError("Unauthenticated");

    let q = sb.from("crm_leads").select("*, crm_stages(name, color)").eq("user_id", userId).order("created_at", { ascending: false });
    if (args.status) q = q.eq("status", args.status);
    if (args.search) {
      q = q.or(`title.ilike.%${args.search}%,email.ilike.%${args.search}%,company.ilike.%${args.search}%`);
    }

    const { data, error } = await q.limit(args.limit);
    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { leads: data ?? [] },
    };
  },
});

export const manageCrmLeads = defineTool({
  name: "manage_crm_leads",
  title: "Manage CRM Leads",
  description: "Create, update, delete, or convert a lead into an active sales pipeline deal.",
  inputSchema: {
    action: z.enum(["create", "update", "delete", "convert_to_deal"]),
    id: z.string().uuid().optional().describe("Lead ID"),
    title: z.string().max(300).optional().describe("Lead title"),
    first_name: z.string().max(100).optional(),
    last_name: z.string().max(100).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(50).optional(),
    company: z.string().max(300).optional(),
    source: z.string().max(100).optional().describe("Source: website, referral, cold_outreach, social, etc."),
    status: z.enum(["new", "in_progress", "converted", "lost"]).optional(),
    lead_value: z.number().min(0).optional(),
    currency: z.string().max(8).optional(),
    expected_close: z.string().optional(),
    description: z.string().max(5000).optional(),
    contact_id: z.string().uuid().optional().describe("Existing contact ID for conversion or linking"),
    stage_id: z.string().uuid().optional().describe("Target pipeline stage ID for deal conversion"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId?.() ?? (await sb.auth.getUser()).data.user?.id;
    if (!userId) throw new ToolError("Unauthenticated");

    if (args.action === "create") {
      if (!args.title) throw new ToolError("Lead title is required");
      const { data, error } = await sb
        .from("crm_leads")
        .insert({
          user_id: userId,
          title: args.title,
          first_name: args.first_name ?? null,
          last_name: args.last_name ?? null,
          email: args.email ?? null,
          phone: args.phone ?? null,
          company: args.company ?? null,
          source: args.source ?? "website",
          status: args.status ?? "new",
          lead_value: args.lead_value ?? 0,
          currency: args.currency ?? "USD",
          expected_close: args.expected_close ?? null,
          description: args.description ?? null,
        })
        .select()
        .single();
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Lead created (${data.id})` }], structuredContent: { lead: data } };
    }

    if (args.action === "update") {
      if (!args.id) throw new ToolError("Lead ID is required");
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const [k, v] of Object.entries(args)) {
        if (k !== "action" && k !== "id" && v !== undefined) patch[k] = v;
      }
      const { data, error } = await sb.from("crm_leads").update(patch).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Updated lead ${args.id}` }], structuredContent: { lead: data } };
    }

    if (args.action === "convert_to_deal") {
      if (!args.id) throw new ToolError("Lead ID is required");
      if (!args.contact_id) throw new ToolError("contact_id is required to link the new deal to");

      const { data: lead, error: getErr } = await sb.from("crm_leads").select("*").eq("id", args.id).eq("user_id", userId).single();
      if (getErr || !lead) throw new ToolError("Lead not found");

      let stageId = args.stage_id;
      if (!stageId) {
        const { data: st } = await sb.from("crm_stages").select("id").eq("user_id", userId).order("position").limit(1);
        stageId = st?.[0]?.id;
      }

      const { data: deal, error: dealErr } = await sb
        .from("crm_deals")
        .insert({
          user_id: userId,
          contact_id: args.contact_id,
          stage_id: stageId!,
          title: lead.title,
          value: lead.lead_value,
          currency: lead.currency,
          expected_close: lead.expected_close,
        })
        .select()
        .single();
      if (dealErr) throw new ToolError(dealErr.message);

      await sb.from("crm_leads").update({ status: "converted", contact_id: args.contact_id, deal_id: deal.id }).eq("id", args.id).eq("user_id", userId);
      return {
        content: [{ type: "text", text: `Converted lead "${lead.title}" to active pipeline deal (${deal.id})` }],
        structuredContent: { deal },
      };
    }

    if (args.action === "delete") {
      if (!args.id) throw new ToolError("Lead ID is required");
      const { error } = await sb.from("crm_leads").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Deleted lead ${args.id}` }], structuredContent: { ok: true } };
    }

    throw new ToolError("Unknown action");
  },
});
