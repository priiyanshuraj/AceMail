import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_campaigns",
  title: "List campaigns",
  description: "List campaigns with status, list, schedule and steps (template + delay).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_i, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("campaigns")
      .select("id, name, status, list_id, timezone, send_days, send_window_start, send_window_end, started_at, completed_at, created_at, campaign_steps(step_order, delay_days, template_id)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new ToolError(error.message);
    const campaigns = (data ?? []).map((c) => ({
      id: c.id, name: c.name, status: c.status, list_id: c.list_id, timezone: c.timezone,
      send_days: c.send_days, send_window_start: c.send_window_start, send_window_end: c.send_window_end,
      started_at: c.started_at, completed_at: c.completed_at,
      steps: (c.campaign_steps ?? []).sort((a, b) => a.step_order - b.step_order).map((s) => ({ step_order: s.step_order, delay_days: s.delay_days, template_id: s.template_id })),
    }));
    return { content: [{ type: "text", text: JSON.stringify(campaigns) }], structuredContent: { campaigns } };
  },
});
