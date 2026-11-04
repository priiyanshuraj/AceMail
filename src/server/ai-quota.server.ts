// Server-only daily AI generation allowance. Users with their own AI key are unlimited;
// everyone else uses the shared Groq key, capped per day (admin-controlled, default 20).
import type { LlmConfig } from "@/server/llm.server";

export type GenKind = "email" | "linkedin";

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

const today = () => new Date().toISOString().slice(0, 10);

export async function getQuota(userId: string) {
  const db = await admin();
  const [{ data: s }, { data: lim }, { data: use }] = await Promise.all([
    db.from("ai_settings").select("default_email_limit, default_linkedin_limit").eq("id", true).maybeSingle(),
    db.from("user_ai_limits").select("ai_enabled, daily_email_limit, daily_linkedin_limit").eq("user_id", userId).maybeSingle(),
    db.from("user_ai_usage").select("emails_generated, linkedin_generated").eq("user_id", userId).eq("usage_date", today()).maybeSingle(),
  ]);
  return {
    enabled: lim?.ai_enabled ?? true,
    emailLimit: lim?.daily_email_limit ?? s?.default_email_limit ?? 20,
    linkedinLimit: lim?.daily_linkedin_limit ?? s?.default_linkedin_limit ?? 20,
    emailsUsed: use?.emails_generated ?? 0,
    linkedinUsed: use?.linkedin_generated ?? 0,
  };
}

const LIMIT_MSG = "You've used today's free AI messages. Connect ChatGPT or Claude through AceMail MCP for unlimited use, or add your own AI key in Settings.";

/** Picks the user's own model (unlimited) or the shared Groq model (counted). */
export async function generationModel(userId: string): Promise<{ cfg: LlmConfig; hosted: boolean }> {
  const { aiStatus, getLlmConfig } = await import("@/server/llm.server");
  const st = await aiStatus(userId);
  if (st.llm) return { cfg: await getLlmConfig(userId), hosted: false };
  const key = process.env["GROQ_API_KEY"];
  if (!key) throw new Error("Free AI is not set up yet. Add your own AI key in Settings.");
  return { cfg: { provider: "custom", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", key }, hosted: true };
}

/** Uses one daily credit; throws a friendly message when the allowance is gone. */
export async function consumeCredit(userId: string, kind: GenKind) {
  const q = await getQuota(userId);
  if (!q.enabled) throw new Error("Free AI is turned off for your account. Add your own AI key in Settings or use AceMail MCP.");
  const db = await admin();
  const { data, error } = await db.rpc("consume_ai_credit", { _user_id: userId, _kind: kind, _limit: kind === "linkedin" ? q.linkedinLimit : q.emailLimit });
  if (error) throw new Error(error.message);
  if (!data) throw new Error(LIMIT_MSG);
}
