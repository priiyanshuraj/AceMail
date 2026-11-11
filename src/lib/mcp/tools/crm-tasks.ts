import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export const listCrmTasks = defineTool({
  name: "list_crm_tasks",
  title: "List CRM Tasks",
  description: "List to-dos, priorities (low/medium/high/urgent), and due dates for contacts, deals, or leads.",
  inputSchema: {
    status: z.enum(["todo", "in_progress", "completed", "cancelled"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    contact_id: z.string().uuid().optional(),
    deal_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(100).default(50),
  },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId?.() ?? (await sb.auth.getUser()).data.user?.id;
    if (!userId) throw new ToolError("Unauthenticated");

    let q = sb
      .from("crm_tasks")
      .select("*, contacts(id, email, first_name, last_name, company), crm_deals(id, title), crm_leads(id, title)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (args.status) q = q.eq("status", args.status);
    if (args.priority) q = q.eq("priority", args.priority);
    if (args.contact_id) q = q.eq("contact_id", args.contact_id);
    if (args.deal_id) q = q.eq("deal_id", args.deal_id);

    const { data, error } = await q.limit(args.limit);
    if (error) throw new ToolError(error.message);

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { tasks: data ?? [] },
    };
  },
});

export const manageCrmTasks = defineTool({
  name: "manage_crm_tasks",
  title: "Manage CRM Tasks",
  description: "Create a task, mark a task completed, update priority or due date, or delete a task.",
  inputSchema: {
    action: z.enum(["create", "update", "delete"]),
    id: z.string().uuid().optional().describe("Task ID for update or delete"),
    title: z.string().max(300).optional().describe("Task title"),
    description: z.string().max(5000).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    status: z.enum(["todo", "in_progress", "completed", "cancelled"]).optional(),
    due_date: z.string().optional().describe("YYYY-MM-DD"),
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
      if (!args.title) throw new ToolError("Task title is required");
      const { data, error } = await sb
        .from("crm_tasks")
        .insert({
          user_id: userId,
          title: args.title,
          description: args.description ?? null,
          priority: args.priority ?? "medium",
          status: args.status ?? "todo",
          due_date: args.due_date ?? null,
          contact_id: args.contact_id ?? null,
          deal_id: args.deal_id ?? null,
          lead_id: args.lead_id ?? null,
        })
        .select()
        .single();
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Task created: "${data.title}" (${data.id})` }], structuredContent: { task: data } };
    }

    if (!args.id) throw new ToolError("id is required for update or delete");

    if (args.action === "update") {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (args.title !== undefined) patch["title"] = args.title;
      if (args.description !== undefined) patch["description"] = args.description;
      if (args.priority !== undefined) patch["priority"] = args.priority;
      if (args.status !== undefined) {
        patch["status"] = args.status;
        if (args.status === "completed") patch["completed_at"] = new Date().toISOString();
      }
      if (args.due_date !== undefined) patch["due_date"] = args.due_date;

      const { data, error } = await sb.from("crm_tasks").update(patch).eq("id", args.id).eq("user_id", userId).select().single();
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Updated task ${args.id}` }], structuredContent: { task: data } };
    }

    if (args.action === "delete") {
      const { error } = await sb.from("crm_tasks").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Deleted task ${args.id}` }], structuredContent: { ok: true } };
    }

    throw new ToolError("Unknown action");
  },
});
