import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: boolean | null }> }; userId: string };

async function assertAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Only admins can do this");
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export const getIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { admin: Boolean(data) };
  });

export const listAiUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await assertAdmin(context as unknown as Ctx);
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: users, error }, { data: s }, { data: limits }, { data: usage }] = await Promise.all([
      db.auth.admin.listUsers({ perPage: 1000 }),
      db.from("ai_settings").select("default_email_limit, default_linkedin_limit").eq("id", true).maybeSingle(),
      db.from("user_ai_limits").select("*"),
      db.from("user_ai_usage").select("*").eq("usage_date", today),
    ]);
    if (error) throw new Error(error.message);
    const defaults = { email: s?.default_email_limit ?? 20, linkedin: s?.default_linkedin_limit ?? 20 };
    return {
      defaults,
      users: users.users.map((u) => {
        const l = limits?.find((x) => x.user_id === u.id);
        const used = usage?.find((x) => x.user_id === u.id);
        return {
          id: u.id, email: u.email ?? "",
          enabled: l?.ai_enabled ?? true,
          emailLimit: l?.daily_email_limit ?? null,
          linkedinLimit: l?.daily_linkedin_limit ?? null,
          emailsUsed: used?.emails_generated ?? 0,
          linkedinUsed: used?.linkedin_generated ?? 0,
        };
      }).sort((a, b) => a.email.localeCompare(b.email)),
    };
  });

export const updateUserAiLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    userId: z.string().uuid(),
    enabled: z.boolean(),
    emailLimit: z.number().int().min(0).max(100000).nullable(),
    linkedinLimit: z.number().int().min(0).max(100000).nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context as unknown as Ctx);
    const { error } = await db.from("user_ai_limits").upsert({
      user_id: data.userId, ai_enabled: data.enabled, daily_email_limit: data.emailLimit, daily_linkedin_limit: data.linkedinLimit, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateAiDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ email: z.number().int().min(0).max(100000), linkedin: z.number().int().min(0).max(100000) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await assertAdmin(context as unknown as Ctx);
    const { error } = await db.from("ai_settings").update({ default_email_limit: data.email, default_linkedin_limit: data.linkedin, updated_at: new Date().toISOString() }).eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
