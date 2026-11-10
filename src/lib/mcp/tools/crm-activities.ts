import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export const listCrmActivities = defineTool({
  name: "list_crm_activities",
  title: "List CRM Activities",
  description: "List scheduled activities (calls, meetings, lunches, tasks, emails) with their status, schedule time, and linked contacts.",
  inputSchema: {
    done: z.boolean().optional().describe("Filter by done status"),
    type: z.enum(["call", "meeting", "lunch", "task", "email"]).optional(),
    contact_id: z.string().uuid().optional(),
    deal_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId?.() ?? (await sb.auth.getUser()).data.user?.id;
    if (!userId) throw new ToolError("Unauthenticated");

    let q = sb.from("crm_activities").select("*, contacts(first_name, last_name, email, company)").eq("user_id", userId).order("schedule_from", { ascending: true });
    if (args.done !== undefined) q = q.eq("done", args.done);
    if (args.type) q = q.eq("type", args.type);
    if (args.contact_id) q = q.eq("contact_id", args.contact_id);
    if (args.deal_id) q = q.eq("deal_id", args.deal_id);

    const { data, error } = await q.limit(args.limit);
    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { activities: data ?? [] },
    };
  },
});

export const manageCrmActivities = defineTool({
  name: "manage_crm_activities",
  title: "Manage CRM Activities",
  description: "Schedule a new activity (call, meeting, lunch, task), mark an activity done, update schedule/notes, or delete an activity.",
  inputSchema: {
    action: z.enum(["create", "update", "mark_done", "delete"]),
    id: z.string().uuid().optional().describe("Activity ID"),
    type: z.enum(["call", "meeting", "lunch", "task", "email"]).optional(),
    title: z.string().max(300).optional(),
    description: z.string().max(5000).optional(),
    location: z.string().max(500).optional(),
    schedule_from: z.string().optional().describe("ISO timestamp for start date/time"),
    schedule_to: z.string().optional().describe("ISO timestamp for end date/time"),
    done: z.boolean().optional(),
    contact_id: z.string().uuid().optional(),
    deal_id: z.string().uuid().optional(),
    lead_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId?.() ?? (await sb.auth.getUser()).data.user?.id;
    if (!userId) throw new ToolError("Unauthenticated");

    if (args.action === "create") {
      if (!args.title) throw new ToolError("Title is required for an activity");
      const { data, error } = await sb
        .from("crm_activities")
        .insert({
          user_id: userId,
          type: args.type ?? "call",
          title: args.title,
          description: args.description ?? null,
          location: args.location ?? null,
          schedule_from: args.schedule_from ?? null,
          schedule_to: args.schedule_to ?? null,
          contact_id: args.contact_id ?? null,
          deal_id: args.deal_id ?? null,
          lead_id: args.lead_id ?? null,
          done: false,
        })
        .select()
        .single();
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Scheduled activity "${args.title}" (${data.id})` }], structuredContent: { activity: data } };
    }

    if (args.action === "mark_done") {
      if (!args.id) throw new ToolError("Activity ID is required");
      const { data, error } = await sb.from("crm_activities").update({ done: args.done ?? true, updated_at: new Date().toISOString() }).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Marked activity ${args.id} as done` }], structuredContent: { activity: data } };
    }

    if (args.action === "update") {
      if (!args.id) throw new ToolError("Activity ID is required");
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const [k, v] of Object.entries(args)) {
        if (k !== "action" && k !== "id" && v !== undefined) patch[k] = v;
      }
      const { data, error } = await sb.from("crm_activities").update(patch).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Updated activity ${args.id}` }], structuredContent: { activity: data } };
    }

    if (args.action === "delete") {
      if (!args.id) throw new ToolError("Activity ID is required");
      const { error } = await sb.from("crm_activities").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Deleted activity ${args.id}` }], structuredContent: { ok: true } };
    }

    throw new ToolError("Unknown action");
  },
});
