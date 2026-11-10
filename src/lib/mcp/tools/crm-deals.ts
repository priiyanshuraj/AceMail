import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export const listCrmDeals = defineTool({
  name: "list_crm_deals",
  title: "List CRM Deals",
  description: "List deals in the pipeline with their stages, assigned contacts, close dates, and values.",
  inputSchema: {
    stage_id: z.string().uuid().optional().describe("Filter by specific stage ID"),
    contact_id: z.string().uuid().optional().describe("Filter by contact ID"),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId?.() ?? (await sb.auth.getUser()).data.user?.id;
    if (!userId) throw new ToolError("Unauthenticated");

    let q = sb
      .from("crm_deals")
      .select("*, contacts(id, email, first_name, last_name, company), crm_stages(id, name, color, is_won, is_lost)")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (args.stage_id) q = q.eq("stage_id", args.stage_id);
    if (args.contact_id) q = q.eq("contact_id", args.contact_id);

    const { data, error } = await q.limit(args.limit);
    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { deals: data ?? [] },
    };
  },
});

export const manageCrmDeals = defineTool({
  name: "manage_crm_deals",
  title: "Manage CRM Deals",
  description: "Create a deal, move a deal to another stage, update deal value/title/expected close, or delete a deal.",
  inputSchema: {
    action: z.enum(["create", "update", "move", "delete"]),
    id: z.string().optional().describe("Deal ID (for update, move, delete)"),
    contact_id: z.string().optional().describe("Contact ID or contact email/name for new deal"),
    stage_id: z.string().optional().describe("Target stage ID or stage name"),
    title: z.string().max(300).optional().describe("Deal title"),
    value: z.number().min(0).optional().describe("Deal monetary value"),
    currency: z.string().max(8).optional().describe("Currency (USD, EUR, etc.)"),
    expected_close: z.string().optional().describe("Expected close date YYYY-MM-DD"),
    lost_reason: z.string().max(500).optional().describe("Reason deal was lost"),
    won_reason: z.string().max(500).optional().describe("Reason deal was won"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId?.() ?? (await sb.auth.getUser()).data.user?.id;
    if (!userId) throw new ToolError("Unauthenticated");

    const resolveStageId = async (idOrName?: string): Promise<string | undefined> => {
      if (!idOrName) return undefined;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrName);
      if (isUuid) return idOrName;
      const { data } = await sb.from("crm_stages").select("id").eq("user_id", userId).ilike("name", `%${idOrName}%`).limit(1).maybeSingle();
      return data?.id;
    };

    const resolveContactId = async (idOrQuery?: string): Promise<string | undefined> => {
      if (!idOrQuery) return undefined;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrQuery);
      if (isUuid) return idOrQuery;
      const { data } = await sb.from("contacts").select("id").eq("user_id", userId).or(`email.ilike.%${idOrQuery}%,first_name.ilike.%${idOrQuery}%,company.ilike.%${idOrQuery}%`).limit(1).maybeSingle();
      return data?.id;
    };

    if (args.action === "create") {
      const contactId = await resolveContactId(args.contact_id);
      if (!contactId) throw new ToolError("contact_id is required to create a deal");
      let stageId = await resolveStageId(args.stage_id);
      if (!stageId) {
        const { data: stages } = await sb.from("crm_stages").select("id").eq("user_id", userId).order("position").limit(1);
        stageId = stages?.[0]?.id;
      }
      if (!stageId) throw new ToolError("No pipeline stages found");

      const { data, error } = await sb
        .from("crm_deals")
        .insert({
          user_id: userId,
          contact_id: contactId,
          stage_id: stageId,
          title: args.title ?? "",
          value: args.value ?? 0,
          currency: args.currency ?? "USD",
          expected_close: args.expected_close ?? null,
        })
        .select()
        .single();
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Deal created (${data.id})` }], structuredContent: { deal: data } };
    }

    if (args.action === "move" || args.action === "update") {
      if (!args.id) throw new ToolError("Deal ID is required");
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (args.stage_id) {
        const sid = await resolveStageId(args.stage_id);
        if (sid) patch.stage_id = sid;
      }
      if (args.title !== undefined) patch.title = args.title;
      if (args.value !== undefined) patch.value = args.value;
      if (args.currency !== undefined) patch.currency = args.currency;
      if (args.expected_close !== undefined) patch.expected_close = args.expected_close;
      if (args.lost_reason !== undefined) patch.lost_reason = args.lost_reason;
      if (args.won_reason !== undefined) patch.won_reason = args.won_reason;

      const { data, error } = await sb.from("crm_deals").update(patch).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Updated deal ${args.id}` }], structuredContent: { deal: data } };
    }

    if (args.action === "delete") {
      if (!args.id) throw new ToolError("Deal ID is required");
      const { error } = await sb.from("crm_deals").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Deleted deal ${args.id}` }], structuredContent: { ok: true } };
    }

    throw new ToolError("Unknown action");
  },
});
