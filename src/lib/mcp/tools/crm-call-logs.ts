import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export const listCrmCallLogs = defineTool({
  name: "list_crm_call_logs",
  title: "List CRM Call Logs",
  description: "List phone call history, talk time durations, summaries, and outcomes with linked contacts/deals/leads.",
  inputSchema: {
    contact_id: z.string().uuid().optional(),
    deal_id: z.string().uuid().optional(),
    lead_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(100).default(50),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId?.() ?? (await sb.auth.getUser()).data.user?.id;
    if (!userId) throw new ToolError("Unauthenticated");

    let q = sb
      .from("crm_call_logs")
      .select("*, contacts(id, email, first_name, last_name, company), crm_deals(id, title), crm_leads(id, title)")
      .eq("user_id", userId)
      .order("started_at", { ascending: false });

    if (args.contact_id) q = q.eq("contact_id", args.contact_id);
    if (args.deal_id) q = q.eq("deal_id", args.deal_id);
    if (args.lead_id) q = q.eq("lead_id", args.lead_id);

    const { data, error } = await q.limit(args.limit);
    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { call_logs: data ?? [] },
    };
  },
});

export const manageCrmCallLogs = defineTool({
  name: "manage_crm_call_logs",
  title: "Manage CRM Call Logs",
  description: "Log a completed or missed call, update call notes, or delete a call record.",
  inputSchema: {
    action: z.enum(["log", "delete"]),
    id: z.string().uuid().optional().describe("Call log ID for delete"),
    contact_id: z.string().uuid().optional(),
    deal_id: z.string().uuid().optional(),
    lead_id: z.string().uuid().optional(),
    type: z.enum(["inbound", "outbound"]).default("outbound"),
    status: z.enum(["completed", "missed", "busy", "no_answer", "voicemail"]).default("completed"),
    duration_seconds: z.number().int().min(0).default(0),
    phone_number: z.string().max(50).optional(),
    summary: z.string().max(5000).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId?.() ?? (await sb.auth.getUser()).data.user?.id;
    if (!userId) throw new ToolError("Unauthenticated");

    if (args.action === "log") {
      const { data, error } = await sb
        .from("crm_call_logs")
        .insert({
          user_id: userId,
          contact_id: args.contact_id ?? null,
          deal_id: args.deal_id ?? null,
          lead_id: args.lead_id ?? null,
          type: args.type,
          status: args.status,
          duration_seconds: args.duration_seconds,
          phone_number: args.phone_number ?? null,
          summary: args.summary ?? null,
        })
        .select()
        .single();
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Call logged (${data.id})` }], structuredContent: { call_log: data } };
    }

    if (args.action === "delete") {
      if (!args.id) throw new ToolError("id is required to delete a call log");
      const { error } = await sb.from("crm_call_logs").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Deleted call log ${args.id}` }], structuredContent: { ok: true } };
    }

    throw new ToolError("Unknown action");
  },
});
