import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Connect Gmail ----------

export const startGmailConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ configId: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const { GATEWAY_BASE_URL, GMAIL_CONNECTOR, GMAIL_SCOPES, getMailboxKey } = await import("@/server/gmail.server");
    const clientKey = process.env["GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY"];
    if (!clientKey) throw new Error("Gmail connection is not configured yet");
    const request = getRequest();
    if (!request) throw new Error("OAuth must start from an app request.");
    const url = new URL(request.url);
    const sandboxHost = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL("/api/oauth/google/return", sandboxHost ? `https://${sandboxHost}` : url.origin).toString();

    let existingKey: string | null = null;
    let appUserId = `${context.userId}:${crypto.randomUUID()}`;
    if (data.configId) {
      const { data: own } = await context.supabase.from("email_configurations").select("id").eq("id", data.configId).maybeSingle();
      if (own) {
        existingKey = await getMailboxKey(data.configId);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: cred } = await supabaseAdmin
          .from("mailbox_credentials")
          .select("app_user_id")
          .eq("config_id", data.configId)
          .maybeSingle();
        if (existingKey && cred?.app_user_id) appUserId = cred.app_user_id;
        else if (existingKey) appUserId = context.userId;
        else existingKey = null;
      }
    }
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: GMAIL_CONNECTOR,
      appUserId,
      clientAPIKey: clientKey,
      returnUrl,
      connectionAPIKey: existingKey ?? undefined,
      credentialsConfiguration: { scopes: GMAIL_SCOPES },
    });
    return { authorizationUrl, appUserId };
  });

export const completeGmailConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().min(1), appUserId: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector");
    const { GATEWAY_BASE_URL, GMAIL_CONNECTOR, gmailCall, saveMailboxKey } = await import("@/server/gmail.server");
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY_BASE_URL, data.code);
    if (connectorId !== GMAIL_CONNECTOR) throw new Error("OAuth completion returned the wrong connector");
    const profile = (await gmailCall(connectionAPIKey, "/gmail/v1/users/me/profile")) as { emailAddress: string };
    const email = profile.emailAddress.toLowerCase();

    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("email_configurations")
      .select("id")
      .eq("user_id", userId)
      .eq("from_email", email)
      .maybeSingle();
    let configId = existing?.id;
    if (configId) {
      await supabase.from("email_configurations").update({ provider: "gmail", status: "active" }).eq("id", configId);
    } else {
      const { count } = await supabase.from("email_configurations").select("id", { count: "exact", head: true }).eq("user_id", userId);
      const { data: row, error } = await supabase
        .from("email_configurations")
        .insert({
          user_id: userId,
          name: email,
          provider: "gmail",
          from_email: email,
          from_name: "",
          smtp_host: "",
          smtp_username: "",
          smtp_password: "",
          daily_limit: 50,
          hourly_limit: 10,
          delay_seconds: 60,
          is_default: (count ?? 0) === 0,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      configId = row.id;
    }
    const appUserId = data.appUserId?.startsWith(`${userId}`) ? data.appUserId : userId;
    await saveMailboxKey(configId, userId, connectionAPIKey, appUserId);
    return { ok: true, email, reconnected: !!existing };
  });

// ---------- Mailboxes ----------

export const listMailboxes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { effectiveDailyLimit } = await import("@/server/gmail.server");
    const { supabase, userId } = context;
    const { data: boxes, error } = await supabase
      .from("email_configurations")
      .select("id, name, provider, from_email, from_name, daily_limit, hourly_limit, delay_seconds, is_default, warmup_enabled, warmup_start_volume, warmup_increment, warmup_started_at, status, last_synced_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { data: logs } = await supabase
      .from("email_logs")
      .select("status, sent_at, created_at, campaigns!inner(config_id)")
      .eq("user_id", userId)
      .gte("created_at", weekAgo);

    return (boxes ?? []).map((b) => {
      const mine = (logs ?? []).filter((l) => (l.campaigns as unknown as { config_id: string | null })?.config_id === b.id);
      const delivered = mine.filter((l) => l.sent_at);
      const sentToday = delivered.filter((l) => l.sent_at! >= dayStart.toISOString()).length;
      const sentHour = delivered.filter((l) => l.sent_at! >= hourAgo).length;
      const failed = mine.filter((l) => l.status === "failed").length;
      const replied = mine.filter((l) => l.status === "replied").length;
      const opened = mine.filter((l) => l.status === "opened").length;
      const attempted = delivered.length + failed;
      const bounceRate = attempted ? failed / attempted : 0;
      const health = b.status === "reconnect" ? "reconnect" : bounceRate > 0.05 ? "at_risk" : bounceRate > 0.02 ? "fair" : "good";
      return {
        ...b,
        effective_daily_limit: effectiveDailyLimit(b),
        stats: { sentToday, sentHour, sent7d: delivered.length, failed7d: failed, replied7d: replied, opened7d: opened, bounceRate },
        health,
      };
    });
  });

export const updateMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        from_name: z.string().max(100),
        from_email: z.string().email().max(200),
        daily_limit: z.number().int().min(1).max(2000),
        hourly_limit: z.number().int().min(1).max(500),
        delay_seconds: z.number().int().min(10).max(3600),
        warmup_enabled: z.boolean(),
        warmup_start_volume: z.number().int().min(1).max(100),
        warmup_increment: z.number().int().min(1).max(50),
        is_default: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cur } = await supabase.from("email_configurations").select("warmup_enabled, warmup_started_at").eq("id", data.id).single();
    const { id, ...rest } = data;
    const warmup_started_at = data.warmup_enabled
      ? cur?.warmup_enabled && cur.warmup_started_at
        ? cur.warmup_started_at
        : new Date().toISOString()
      : null;
    if (data.is_default) {
      await supabase.from("email_configurations").update({ is_default: false }).eq("user_id", userId);
    }
    const { error } = await supabase
      .from("email_configurations")
      .update({ ...rest, warmup_started_at, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectMailbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: own } = await context.supabase.from("email_configurations").select("id, provider").eq("id", data.id).maybeSingle();
    if (!own) throw new Error("Mailbox not found");
    if (own.provider === "gmail") {
      const { getMailboxKey, GATEWAY_BASE_URL, GMAIL_CONNECTOR } = await import("@/server/gmail.server");
      const key = await getMailboxKey(data.id);
      if (key) {
        const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
        await disconnectAppUser({ gatewayBaseUrl: GATEWAY_BASE_URL, connectionAPIKey: key, connectorId: GMAIL_CONNECTOR }).catch((e) =>
          console.error("Gateway disconnect failed", e),
        );
      }
    }
    const { error } = await context.supabase.from("email_configurations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ configId: z.string().uuid(), templateId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: box } = await supabase.from("email_configurations").select("id, provider, from_email, from_name").eq("id", data.configId).single();
    const { data: tpl } = await supabase.from("email_templates").select("subject, body").eq("id", data.templateId).single();
    if (!box || !tpl) throw new Error("Mailbox or template not found");
    if (box.provider !== "gmail") throw new Error("Test sends are available for connected Gmail mailboxes");
    const { getMailboxKey, gmailSend } = await import("@/server/gmail.server");
    const key = await getMailboxKey(box.id);
    if (!key) throw new Error("Mailbox needs to be reconnected");
    const render = (t: string) =>
      t.replaceAll("{{first_name}}", "Alex").replaceAll("{{last_name}}", "Sample").replaceAll("{{company}}", "Acme Inc").replaceAll("{{email}}", box.from_email);
    const { prepareEmail } = await import("@/server/email-content.server");
    const prepared = await prepareEmail(render(tpl.body), context.userId, supabase);
    await gmailSend(key, {
      from: box.from_email,
      fromName: box.from_name,
      to: box.from_email,
      subject: render(tpl.subject),
      html: prepared.html,
      attachments: prepared.attachments,
    });
    return { ok: true, to: box.from_email };
  });

// ---------- Direct send ----------

export const sendDirectEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        configId: z.string().uuid(),
        to: z.string().email().max(320),
        subject: z.string().max(500),
        body: z.string().max(200000),
        includeSignature: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: box } = await supabase
      .from("email_configurations")
      .select("id, provider, from_email, from_name, status")
      .eq("id", data.configId)
      .single();
    if (!box) throw new Error("Mailbox not found");
    if (box.provider !== "gmail") throw new Error("Direct send is available for connected Gmail mailboxes");
    const { getMailboxKey, gmailSend } = await import("@/server/gmail.server");
    const key = await getMailboxKey(box.id);
    if (!key) throw new Error("Mailbox needs to be reconnected");
    const { prepareEmail } = await import("@/server/email-content.server");
    const { appendSignature, signatureHtml } = await import("@/lib/email-content");
    let body = data.body;
    if (data.includeSignature) {
      const { data: sig } = await supabase.from("user_signatures").select("signature").eq("user_id", userId).maybeSingle();
      if (sig?.signature) body = appendSignature(body, signatureHtml(sig.signature));
    }
    const prepared = await prepareEmail(body, userId, supabase);
    const sent = await gmailSend(key, {
      from: box.from_email,
      fromName: box.from_name,
      to: data.to,
      subject: data.subject,
      html: prepared.html,
      attachments: prepared.attachments,
    });
    await supabase.from("email_logs").insert({
      user_id: userId,
      status: "sent",
      sent_at: new Date().toISOString(),
      gmail_message_id: sent.id,
      gmail_thread_id: sent.threadId,
      direct_to: data.to,
      direct_subject: data.subject,
      config_id: box.id,
    });
    return { ok: true, to: data.to };
  });

// ---------- Unified inbox ----------

export const listInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("inbox_messages")
      .select("id, from_email, from_name, subject, snippet, is_read, received_at, gmail_thread_id, config_id, campaigns(name), email_configurations(from_email)")
      .eq("user_id", context.userId)
      .order("received_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data;
  });

export const markInboxRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), is_read: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("inbox_messages").update({ is_read: data.is_read }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const syncInboxNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncMailboxReplies } = await import("@/server/gmail.server");
    const { data: boxes } = await context.supabase
      .from("email_configurations")
      .select("id, from_email")
      .eq("user_id", context.userId)
      .eq("provider", "gmail");
    let synced = 0;
    for (const b of boxes ?? []) {
      const r = await syncMailboxReplies(b.id, context.userId, b.from_email);
      synced += r.synced;
    }
    return { synced };
  });

// ---------- Outbox ----------

export const listOutbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("email_logs")
      .select(
        "id, status, error, scheduled_at, sent_at, opened_at, replied_at, gmail_thread_id, contacts(email, first_name, last_name, company), campaigns(name, config_id), campaign_steps(step_order, email_templates(subject))",
      )
      .eq("user_id", context.userId)
      .order("scheduled_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    const configIds = [...new Set((data ?? []).map((l) => (l.campaigns as unknown as { config_id: string | null })?.config_id).filter(Boolean))] as string[];
    const { data: boxes } = configIds.length
      ? await context.supabase.from("email_configurations").select("id, from_email").in("id", configIds)
      : { data: [] };
    const boxById = new Map((boxes ?? []).map((b) => [b.id, b.from_email]));
    return (data ?? []).map((l) => ({
      ...l,
      mailbox_email: boxById.get((l.campaigns as unknown as { config_id: string | null })?.config_id ?? "") ?? null,
    }));
  });
