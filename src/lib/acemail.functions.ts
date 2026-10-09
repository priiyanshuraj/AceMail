import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Dashboard ----------

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [campaigns, contacts, logs] = await Promise.all([
      supabase.from("campaigns").select("id, status").eq("user_id", userId),
      supabase.from("contacts").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("email_logs").select("status").eq("user_id", userId),
    ]);
    const logRows = logs.data ?? [];
    const sent = logRows.filter((l) => l.status === "sent" || l.status === "opened").length;
    const opened = logRows.filter((l) => l.status === "opened").length;
    const failed = logRows.filter((l) => l.status === "failed").length;
    return {
      totalCampaigns: campaigns.data?.length ?? 0,
      activeCampaigns: campaigns.data?.filter((c) => c.status === "running").length ?? 0,
      totalContacts: contacts.count ?? 0,
      sent,
      opened,
      failed,
      openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
    };
  });

// ---------- Contacts ----------

export const listContactLists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: lists, error } = await supabase
      .from("contact_lists")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const counts = await Promise.all(
      (lists ?? []).map(async (l) => {
        const { count } = await supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("list_id", l.id);
        return { ...l, contact_count: count ?? 0 };
      })
    );
    return counts;
  });

export const createContactList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().min(1), description: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("contact_lists")
      .insert({ user_id: userId, name: data.name, description: data.description ?? "" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteContactList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("contact_lists").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ listId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("contacts")
      .select("*")
      .eq("list_id", data.listId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return rows;
  });

const contactRow = z.object({
  email: z.string().email(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company: z.string().optional(),
});

export const importContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ listId: z.string().uuid(), contacts: z.array(contactRow).max(5000) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const rows = data.contacts.map((c) => ({
      user_id: userId,
      list_id: data.listId,
      email: c.email.toLowerCase().trim(),
      first_name: c.first_name ?? "",
      last_name: c.last_name ?? "",
      company: c.company ?? "",
    }));
    const { error } = await supabase
      .from("contacts")
      .upsert(rows, { onConflict: "list_id,email", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { imported: rows.length };
  });

export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("contacts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Templates ----------

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("email_templates")
      .select("*")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1),
        subject: z.string(),
        body: z.string(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { data: row, error } = await supabase
        .from("email_templates")
        .update({ name: data.name, subject: data.subject, body: data.body, updated_at: new Date().toISOString() })
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabase
      .from("email_templates")
      .insert({ user_id: userId, name: data.name, subject: data.subject, body: data.body })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("email_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Email configurations ----------

export const listEmailConfigs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("email_configurations")
      .select("id, name, smtp_host, smtp_port, smtp_username, from_email, from_name, imap_host, imap_port, daily_limit, delay_seconds, is_default, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const saveEmailConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1),
        smtp_host: z.string().min(1),
        smtp_port: z.number().int().min(1).max(65535),
        smtp_username: z.string().min(1),
        smtp_password: z.string().min(1),
        from_email: z.string().email(),
        from_name: z.string().optional(),
        daily_limit: z.number().int().min(1).max(10000),
        delay_seconds: z.number().int().min(10).max(3600),
        is_default: z.boolean().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      user_id: userId,
      name: data.name,
      smtp_host: data.smtp_host,
      smtp_port: data.smtp_port,
      smtp_username: data.smtp_username,
      smtp_password: data.smtp_password,
      from_email: data.from_email,
      from_name: data.from_name ?? "",
      daily_limit: data.daily_limit,
      delay_seconds: data.delay_seconds,
      is_default: data.is_default ?? false,
      updated_at: new Date().toISOString(),
    };
    if (data.is_default) {
      await supabase.from("email_configurations").update({ is_default: false }).eq("user_id", userId);
    }
    if (data.id) {
      const { error } = await supabase.from("email_configurations").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase.from("email_configurations").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteEmailConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("email_configurations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Blacklisted domains ----------

export const listBlacklistedDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("blacklisted_domains")
      .select("*")
      .eq("user_id", context.userId)
      .order("domain");
    if (error) throw new Error(error.message);
    return data;
  });

export const addBlacklistedDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ domain: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("blacklisted_domains")
      .upsert({ user_id: context.userId, domain: data.domain.toLowerCase().trim() }, { onConflict: "user_id,domain" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeBlacklistedDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("blacklisted_domains").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Campaigns ----------

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: campaigns, error } = await supabase
      .from("campaigns")
      .select("*, contact_lists(name)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const withStats = await Promise.all(
      (campaigns ?? []).map(async (c) => {
        const { data: logs } = await supabase.from("email_logs").select("status").eq("campaign_id", c.id);
        const rows = logs ?? [];
        return {
          ...c,
          stats: {
            queued: rows.filter((l) => l.status === "queued").length,
            sent: rows.filter((l) => l.status === "sent" || l.status === "opened").length,
            opened: rows.filter((l) => l.status === "opened").length,
            failed: rows.filter((l) => l.status === "failed").length,
          },
        };
      })
    );
    return withStats;
  });

export const getCampaign = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select("*, contact_lists(name), email_configurations(name, from_email)")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: steps } = await supabase
      .from("campaign_steps")
      .select("*, email_templates(name, subject)")
      .eq("campaign_id", data.id)
      .order("step_order");
    const { data: logs } = await supabase
      .from("email_logs")
      .select("id, status, error, scheduled_at, sent_at, opened_at, step_id, contacts(email, first_name, last_name)")
      .eq("campaign_id", data.id)
      .order("created_at", { ascending: false })
      .limit(200);
    return { campaign, steps: steps ?? [], logs: logs ?? [] };
  });

const stepInput = z.object({
  template_id: z.string().uuid(),
  step_order: z.number().int().min(1),
  delay_days: z.number().int().min(0).max(365),
});

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(1),
        list_id: z.string().uuid(),
        config_id: z.string().uuid(),
        steps: z.array(stepInput).min(1),
        send_window_start: z.string().optional(),
        send_window_end: z.string().optional(),
        send_days: z.array(z.number().int().min(0).max(6)).optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .insert({
        user_id: userId,
        name: data.name,
        list_id: data.list_id,
        config_id: data.config_id,
        send_window_start: data.send_window_start ?? null,
        send_window_end: data.send_window_end ?? null,
        send_days: data.send_days ?? [1, 2, 3, 4, 5],
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const { error: stepError } = await supabase.from("campaign_steps").insert(
      data.steps.map((s) => ({
        campaign_id: campaign.id,
        template_id: s.template_id,
        step_order: s.step_order,
        delay_days: s.delay_days,
      }))
    );
    if (stepError) throw new Error(stepError.message);
    return campaign;
  });

export const setCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["draft", "running", "paused", "completed", "discontinued"]) })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const updates: Record<string, unknown> = { status: data.status };
    if (data.status === "running") {
      const { data: campaign } = await supabase.from("campaigns").select("*, contact_lists(id)").eq("id", data.id).single();
      if (!campaign) throw new Error("Campaign not found");
      if (!campaign.config_id) throw new Error("Attach an email configuration before starting");
      updates.started_at = new Date().toISOString();
      // Enqueue step 1 for all subscribed, non-blacklisted contacts
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, email")
        .eq("list_id", campaign.list_id)
        .eq("unsubscribed", false);
      const { data: blacklist } = await supabase.from("blacklisted_domains").select("domain").eq("user_id", userId);
      const blocked = new Set((blacklist ?? []).map((b) => b.domain));
      const { data: steps } = await supabase
        .from("campaign_steps")
        .select("id")
        .eq("campaign_id", data.id)
        .eq("step_order", 1);
      const step1 = steps?.[0];
      if (step1 && contacts) {
        const rows = contacts
          .filter((c) => !blocked.has(c.email.split("@")[1]?.toLowerCase()))
          .map((c) => ({
            user_id: userId,
            campaign_id: data.id,
            step_id: step1.id,
            contact_id: c.id,
            status: "queued" as const,
          }));
        if (rows.length > 0) {
          await supabase.from("email_logs").upsert(rows, {
            onConflict: "campaign_id,step_id,contact_id",
            ignoreDuplicates: true,
          });
        }
      }
    }
    if (data.status === "completed") updates.completed_at = new Date().toISOString();
    const { error } = await supabase.from("campaigns").update(updates).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
