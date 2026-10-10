import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CampaignAnalytics } from "@/lib/campaign-analytics";

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

export const listOpenedEmails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("email_logs")
      .select("id, opened_at, sent_at, contacts(email, first_name, last_name, company), campaigns(name)")
      .eq("user_id", userId)
      .eq("status", "opened")
      .order("opened_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
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
  custom_fields: z.record(z.string().max(64), z.string()).optional(),
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
      custom_fields: c.custom_fields ?? {},
    }));
    const { error } = await supabase
      .from("contacts")
      .upsert(rows, { onConflict: "list_id,email", ignoreDuplicates: false });
    if (error) throw new Error(error.message);
    return { imported: rows.length };
  });

/** All custom field names used across the user's contacts (for mapping + template variables). */
export const listCustomFieldKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contacts")
      .select("custom_fields")
      .neq("custom_fields", "{}")
      .limit(2000);
    if (error) throw new Error(error.message);
    const keys = new Set<string>();
    for (const r of data ?? []) {
      for (const k of Object.keys((r.custom_fields as Record<string, unknown>) ?? {})) keys.add(k);
    }
    return [...keys].sort();
  });

export const listPreviewContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contacts")
      .select("id, email, first_name, last_name, company, custom_fields")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
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
        attach_signature: z.boolean().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const fields = {
      name: data.name,
      subject: data.subject,
      body: data.body,
      attach_signature: data.attach_signature ?? false,
    };
    if (data.id) {
      const { data: row, error } = await supabase
        .from("email_templates")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await supabase
      .from("email_templates")
      .insert({ user_id: userId, ...fields })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// ---------- Signature ----------

export const getSignature = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_signatures")
      .select("signature")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.signature ?? "";
  });

export const saveSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ signature: z.string().max(5000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_signatures")
      .upsert({ user_id: context.userId, signature: data.signature, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTemplateTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        subject: z.string().max(500),
        body: z.string().max(200000),
        attach_signature: z.boolean().optional(),
        preview_contact_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: box } = await supabase
      .from("email_configurations")
      .select("id, provider, from_email, from_name")
      .eq("user_id", userId)
      .eq("provider", "gmail")
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!box) throw new Error("Connect a Gmail mailbox first (Mailboxes page)");
    const { getMailboxKey, gmailSend } = await import("@/server/gmail.server");
    const key = await getMailboxKey(box.id);
    if (!key) throw new Error("Mailbox needs to be reconnected");
    let signature = "";
    if (data.attach_signature) {
      const { data: sig } = await supabase.from("user_signatures").select("signature").eq("user_id", userId).maybeSingle();
      signature = sig?.signature ?? "";
    }
    let values: Record<string, unknown> = { first_name: "Jane", last_name: "Doe", company: "Acme Inc", email: "jane@acme.com" };
    if (data.preview_contact_id) {
      const { data: contact, error } = await supabase.from("contacts")
        .select("first_name, last_name, company, email, custom_fields")
        .eq("id", data.preview_contact_id).eq("user_id", userId).maybeSingle();
      if (error || !contact) throw new Error("The preview contact is no longer available");
      values = { ...(contact.custom_fields as Record<string, unknown> | null ?? {}),
        first_name: contact.first_name || "Jane", last_name: contact.last_name || "Doe",
        company: contact.company || "Acme Inc", email: contact.email || "jane@acme.com" };
    }
    const { renderEmailVariables, signatureHtml, appendSignature } = await import("@/lib/email-content");
    const render = (text: string, html = false) => renderEmailVariables(text, values, html, (key) => `[${key}]`);
    const { prepareEmail } = await import("@/server/email-content.server");
    const body = signature ? appendSignature(render(data.body, true), render(signatureHtml(signature), true)) : render(data.body, true);
    const prepared = await prepareEmail(body, userId, supabase);
    await gmailSend(key, {
      from: box.from_email,
      fromName: box.from_name,
      to: box.from_email,
      subject: render(data.subject),
      html: prepared.html,
      attachments: prepared.attachments,
    });
    return { ok: true, to: box.from_email };
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
    const [{ data: analytics, error: analyticsError }, { data: clicks, error: clickError }, { data: replies, error: replyError }] = await Promise.all([
      supabase.rpc("campaign_analytics", { _campaign_id: data.id }),
      supabase.from("email_click_events").select("log_id, clicked_at, email_logs!inner(campaign_id)").eq("email_logs.campaign_id", data.id).order("clicked_at", { ascending: false }).limit(1000),
      supabase.from("inbox_messages").select("log_id, received_at").eq("campaign_id", data.id).order("received_at", { ascending: false }).limit(1000),
    ]);
    if (analyticsError || clickError || replyError) throw new Error("Could not load campaign analytics");
    return { campaign, steps: steps ?? [], logs: logs ?? [], analytics: analytics as unknown as CampaignAnalytics, clicks: clicks ?? [], replies: replies ?? [] };
  });

const stepInput = z.object({
  id: z.string().uuid().optional(),
  template_id: z.string().uuid(),
  step_order: z.number().int().min(1),
  delay_days: z.number().int().min(0).max(365),
});

const campaignInput = z.object({
  name: z.string().min(1),
  list_id: z.string().uuid(),
  config_id: z.string().uuid(),
  steps: z.array(stepInput).min(1),
  send_window_start: z.string().optional(),
  send_window_end: z.string().optional(),
  send_days: z.array(z.number().int().min(0).max(6)).optional(),
  timezone: z.string().min(1).max(64).optional(),
});

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => campaignInput.parse(d))
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
        timezone: data.timezone ?? "UTC",
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

export const updateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => campaignInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("campaigns")
      .update({
        name: data.name,
        list_id: data.list_id,
        config_id: data.config_id,
        send_window_start: data.send_window_start ?? null,
        send_window_end: data.send_window_end ?? null,
        send_days: data.send_days ?? [1, 2, 3, 4, 5],
        timezone: data.timezone ?? "UTC",
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { data: existing } = await supabase.from("campaign_steps").select("id").eq("campaign_id", data.id);
    const keepIds = new Set(data.steps.map((s) => s.id).filter(Boolean) as string[]);
    const removed = (existing ?? []).filter((s) => !keepIds.has(s.id)).map((s) => s.id);
    if (removed.length > 0) {
      const { count } = await supabase
        .from("email_logs")
        .select("id", { count: "exact", head: true })
        .in("step_id", removed)
        .neq("status", "queued");
      if ((count ?? 0) > 0) throw new Error("Can't remove a step that has already sent emails");
      await supabase.from("email_logs").delete().in("step_id", removed);
      const { error: delErr } = await supabase.from("campaign_steps").delete().in("id", removed);
      if (delErr) throw new Error(delErr.message);
    }
    for (const s of data.steps) {
      if (s.id) {
        const { error: e } = await supabase
          .from("campaign_steps")
          .update({ template_id: s.template_id, step_order: s.step_order, delay_days: s.delay_days })
          .eq("id", s.id)
          .eq("campaign_id", data.id);
        if (e) throw new Error(e.message);
      } else {
        const { error: e } = await supabase.from("campaign_steps").insert({
          campaign_id: data.id,
          template_id: s.template_id,
          step_order: s.step_order,
          delay_days: s.delay_days,
        });
        if (e) throw new Error(e.message);
      }
    }
    return { ok: true };
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
    const updates: { status: string; started_at?: string; completed_at?: string } = { status: data.status };
    if (data.status === "running") {
      const { data: campaign } = await supabase.from("campaigns").select("*, contact_lists(id)").eq("id", data.id).single();
      if (!campaign) throw new Error("Campaign not found");
      if (!campaign.config_id) throw new Error("Attach an email configuration before starting");
      updates["started_at"] = new Date().toISOString();
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
          .filter((c) => !blocked.has(c.email.split("@")[1]?.toLowerCase() ?? ""))
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
    if (data.status === "completed") updates["completed_at"] = new Date().toISOString();
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

export const setLogStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), status: z.enum(["queued", "paused"]) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    // Only queued <-> paused transitions; sent/failed logs are final.
    const from = data.status === "paused" ? "queued" : "paused";
    const { error } = await context.supabase
      .from("email_logs")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("status", from);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Only unsent logs can be removed.
    const { error } = await context.supabase
      .from("email_logs")
      .delete()
      .eq("id", data.id)
      .in("status", ["queued", "paused"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
