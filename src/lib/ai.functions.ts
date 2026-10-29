import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAiStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { aiStatus } = await import("@/server/llm.server");
    return aiStatus(context.userId);
  });

export const saveAiModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    provider: z.enum(["deepseek", "openai", "anthropic", "custom"]),
    baseUrl: z.string().trim().max(300).refine((v) => !v || v.startsWith("https://") || v.startsWith("http://"), "Address must start with https://"),
    model: z.string().trim().max(120),
    key: z.string().trim().max(500).optional(),
    remove: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const m = await import("@/server/llm.server");
    if (data.remove) await m.deleteKey(context.userId, "llm");
    else await m.saveLlmConfig(context.userId, data);
    return { ok: true };
  });

export const saveSearchKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ provider: z.enum(["tavily", "exa"]), key: z.string().trim().max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const m = await import("@/server/llm.server");
    if (!data.key) await m.deleteKey(context.userId, "search");
    else await m.saveSearchConfig(context.userId, data);
    return { ok: true };
  });

export const testAiModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const m = await import("@/server/llm.server");
    const cfg = await m.getLlmConfig(context.userId);
    const r = await m.chat(cfg, [{ role: "user", content: "Reply with the single word: ready" }]);
    return { reply: r.text.slice(0, 200) };
  });

// ---------- Personalised outreach per lead ----------

export const personalizeContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(10), instructions: z.string().max(2000).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    const { personalizeWithDb } = await import("@/server/ai-agent.server");
    return personalizeWithDb(context.supabase, context.userId, data.ids, data.instructions);
  });

// ---------- In-app assistant ----------

export const runAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20000) })).min(1).max(60),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const token = (getRequestHeader("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { runAgent } = await import("@/server/ai-agent.server");
    return runAgent(context.supabase, context.userId, token, data.messages);
  });
