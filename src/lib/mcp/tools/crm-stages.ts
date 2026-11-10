import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export const listCrmStages = defineTool({
  name: "list_crm_stages",
  title: "List CRM Pipeline Stages",
  description: "List all stages in the CRM sales funnel/pipeline, with their deal counts, colors, positions, and won/lost flags.",
  inputSchema: {},
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  handler: async (_args, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId?.() ?? (await sb.auth.getUser()).data.user?.id;
    if (!userId) throw new ToolError("Unauthenticated");

    const { data: stages, error } = await sb
      .from("crm_stages")
      .select("*")
      .eq("user_id", userId)
      .order("position");
    if (error) throw new ToolError(error.message);

    const { data: deals } = await sb
      .from("crm_deals")
      .select("id, stage_id, value, currency")
      .eq("user_id", userId);

    const stagesWithCounts = (stages ?? []).map((s) => {
      const stageDeals = (deals ?? []).filter((d) => d.stage_id === s.id);
      return {
        ...s,
        deals_count: stageDeals.length,
        total_value: stageDeals.reduce((sum, d) => sum + Number(d.value), 0),
      };
    });

    return {
      content: [{ type: "text", text: JSON.stringify(stagesWithCounts, null, 2) }],
      structuredContent: { stages: stagesWithCounts },
    };
  },
});

export const manageCrmStages = defineTool({
  name: "manage_crm_stages",
  title: "Manage CRM Pipeline Stages",
  description:
    "Customize the sales funnel stages: add a new stage, rename or change color of a stage, reorder stages, or delete a stage (optionally migrating deals to another stage). Accepts stage UUID or stage name.",
  inputSchema: {
    action: z.enum(["add", "rename", "reorder", "delete"]),
    id: z.string().optional().describe("Stage ID or exact/partial stage name for rename or delete"),
    name: z.string().trim().min(1).max(60).optional().describe("New stage name (when adding or renaming)"),
    color: z.string().max(20).optional().describe("Stage color (slate, blue, emerald, amber, violet, rose, orange, cyan, indigo, red, green)"),
    is_won: z.boolean().optional().describe("Whether this stage marks closed won deals"),
    is_lost: z.boolean().optional().describe("Whether this stage marks closed lost deals"),
    stage_ids: z.array(z.string()).optional().describe("Ordered array of stage IDs or names for reordering"),
    migrate_to_stage_id: z.string().optional().describe("Destination stage ID or name to move deals to when deleting a stage"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => {
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId?.() ?? (await sb.auth.getUser()).data.user?.id;
    if (!userId) throw new ToolError("Unauthenticated");

    const resolveStageId = async (idOrName: string): Promise<string> => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrName);
      if (isUuid) return idOrName;
      const { data } = await sb.from("crm_stages").select("id").eq("user_id", userId).ilike("name", idOrName).limit(1).maybeSingle();
      if (data?.id) return data.id;
      // Also try contains if exact match failed
      const { data: fuzzy } = await sb.from("crm_stages").select("id").eq("user_id", userId).ilike("name", `%${idOrName}%`).limit(1).maybeSingle();
      if (fuzzy?.id) return fuzzy.id;
      throw new ToolError(`Stage "${idOrName}" not found`);
    };

    if (args.action === "add") {
      if (!args.name) throw new ToolError("Stage name is required to add a stage");
      const { data: existing } = await sb.from("crm_stages").select("position").eq("user_id", userId);
      const maxPos = Math.max(...(existing ?? []).map((s) => s.position), -1);
      const { data, error } = await sb
        .from("crm_stages")
        .insert({
          user_id: userId,
          name: args.name,
          color: args.color ?? "slate",
          position: maxPos + 1,
          is_won: args.is_won ?? false,
          is_lost: args.is_lost ?? false,
        })
        .select()
        .single();
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Added stage "${args.name}" (${data.id})` }], structuredContent: { stage: data } };
    }

    if (args.action === "rename") {
      if (!args.id) throw new ToolError("Stage ID or name is required");
      const targetId = await resolveStageId(args.id);
      const patch: Record<string, unknown> = {};
      if (args.name !== undefined) patch.name = args.name;
      if (args.color !== undefined) patch.color = args.color;
      if (args.is_won !== undefined) patch.is_won = args.is_won;
      if (args.is_lost !== undefined) patch.is_lost = args.is_lost;
      const { data, error } = await sb.from("crm_stages").update(patch).eq("id", targetId).eq("user_id", userId).select().single();
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Updated stage "${data.name}" (${targetId})` }], structuredContent: { stage: data } };
    }

    if (args.action === "reorder") {
      if (!args.stage_ids?.length) throw new ToolError("stage_ids array is required");
      const resolvedIds = await Promise.all(args.stage_ids.map(resolveStageId));
      for (let i = 0; i < resolvedIds.length; i++) {
        await sb.from("crm_stages").update({ position: i }).eq("id", resolvedIds[i]!).eq("user_id", userId);
      }
      return { content: [{ type: "text", text: `Reordered ${resolvedIds.length} stages` }], structuredContent: { ok: true } };
    }

    if (args.action === "delete") {
      if (!args.id) throw new ToolError("Stage ID or name is required");
      const targetId = await resolveStageId(args.id);
      if (args.migrate_to_stage_id) {
        const destId = await resolveStageId(args.migrate_to_stage_id);
        await sb.from("crm_deals").update({ stage_id: destId }).eq("stage_id", targetId).eq("user_id", userId);
      }
      const { error } = await sb.from("crm_stages").delete().eq("id", targetId).eq("user_id", userId);
      if (error) throw new ToolError(error.message);
      return { content: [{ type: "text", text: `Deleted stage ${targetId}` }], structuredContent: { ok: true } };
    }

    throw new ToolError("Unknown action");
  },
});
