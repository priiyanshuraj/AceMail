import { createFileRoute } from "@tanstack/react-router";

// Processes the pending email queue: sends due emails via each user's SMTP
// config and enqueues follow-up steps. Called on a schedule with the project
// publishable key as bearer token (screens stray traffic only — the work is
// idempotent and scoped to already-queued rows).

export const Route = createFileRoute("/api/public/hooks/process-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        try {
          const result = await processQueue();
          return Response.json({ success: true, ...result });
        } catch (err) {
          console.error("Queue processing failed:", err);
          return Response.json(
            { error: err instanceof Error ? err.message : "Queue processing failed" },
            { status: 500 }
          );
        }
      },
    },
  },
});

async function processQueue() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { renderEmailVariables, signatureHtml, appendSignature } = await import("@/lib/email-content");
  const { prepareEmail } = await import("@/server/email-content.server");
  const nodemailer = (await import("nodemailer")).default;
  const { getMailboxKey, gmailSend, effectiveDailyLimit, syncMailboxReplies, ReconnectRequiredError } =
    await import("@/server/gmail.server");

  // Cheap early-exit: the queue runs every minute, but outside campaign time
  // (or once everything due is sent / daily limits are reached and nothing new
  // is due yet) there is nothing to do. One tiny indexed count keeps idle
  // minutes nearly free instead of running reply syncs and heavy joins.
  const { count: dueCount } = await supabaseAdmin
    .from("email_logs")
    .select("id, campaigns!inner(id)", { count: "exact", head: true })
    .eq("status", "queued")
    .eq("campaigns.status", "running")
    .lte("scheduled_at", new Date().toISOString());
  if ((dueCount ?? 0) === 0) return { processed: 0, sent: 0, failed: 0, replies: 0, idle: true };

  // Reply detection first, so replied contacts' follow-ups are cancelled before sending
  // The queue runs every minute; inbox checks only every ~5 minutes per mailbox.
  const syncCutoff = new Date(Date.now() - 4.5 * 60_000).toISOString();
  const { data: gmailBoxes } = await supabaseAdmin
    .from("email_configurations")
    .select("id, user_id, from_email")
    .eq("provider", "gmail")
    .neq("status", "reconnect")
    .or(`last_synced_at.is.null,last_synced_at.lt.${syncCutoff}`);
  let replies = 0;
  for (const b of gmailBoxes ?? []) {
    try {
      replies += (await syncMailboxReplies(b.id, b.user_id, b.from_email)).synced;
    } catch (e) {
      console.error("Reply sync failed for mailbox", b.id, e);
    }
  }

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const { spin, unsubscribeFooter, contactTimezone } = await import("@/lib/deliverability");

  const { data: due, error } = await supabaseAdmin
    .from("email_logs")
    .select(
      "id, campaign_id, step_id, contact_id, user_id, campaigns!inner(status, prioritize_followups, breakup_day_exclusive, timezone, send_window_start, send_window_end, send_days, config_id, rotation_config_ids, recipient_timezone, include_unsubscribe), contacts(email, first_name, last_name, company, unsubscribed, custom_fields), campaign_steps(step_order, delay_days, variant_template_id, email_templates(subject, body, attach_signature))"
    )
    .eq("status", "queued")
    .eq("campaigns.status", "running")
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1000);

  if (error) throw new Error(error.message);
  if (!due || due.length === 0) return { processed: 0, sent: 0, failed: 0, replies };

  let sent = 0;
  let failed = 0;
  const appUrl = process.env["APP_URL"] ?? "";

  type Config = {
    id: string; provider: string; hourly_limit: number; warmup_enabled: boolean; warmup_start_volume: number;
    warmup_increment: number; warmup_started_at: string | null; status: string; smtp_host: string; smtp_port: number;
    smtp_username: string; smtp_password: string; from_email: string; from_name: string; daily_limit: number; delay_seconds: number;
  };
  type Box = { config: Config; remaining: number; key: string | null; transporter: ReturnType<typeof nodemailer.createTransport> | null };
  // Per-mailbox state shared across campaigns in this run (limits and gaps are per mailbox).
  const boxes = new Map<string, Box | null>();
  const getBox = async (configId: string): Promise<Box | null> => {
    if (boxes.has(configId)) return boxes.get(configId) ?? null;
    let box: Box | null = null;
    const { data: config } = await supabaseAdmin.from("email_configurations").select("*").eq("id", configId).maybeSingle();
    if (config && config.status !== "reconnect") {
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const countSince = async (since: string) => {
        const { count } = await supabaseAdmin.from("email_logs").select("id", { count: "exact", head: true })
          .eq("config_id", configId).not("sent_at", "is", null).gte("sent_at", since);
        return count ?? 0;
      };
      let remaining = Math.max(0, Math.min(
        effectiveDailyLimit(config) - (await countSince(dayStart.toISOString())),
        config.hourly_limit - (await countSince(new Date(now.getTime() - 3600_000).toISOString())),
      ));
      const gap = Math.max(0, config.delay_seconds) * 1000;
      if (remaining > 0 && gap > 0) {
        const { data: lastSent } = await supabaseAdmin.from("email_logs").select("sent_at")
          .eq("config_id", configId).not("sent_at", "is", null).order("sent_at", { ascending: false }).limit(1).maybeSingle();
        const since = lastSent?.sent_at ? now.getTime() - new Date(lastSent.sent_at).getTime() : Infinity;
        if (since < gap - 5000) remaining = 0;
        else remaining = Math.min(remaining, gap >= 50_000 ? 1 : Math.max(1, Math.floor(50_000 / gap)));
      }
      const isGmail = config.provider === "gmail";
      const key = isGmail && remaining > 0 ? await getMailboxKey(config.id) : null;
      if (!isGmail || key) {
        box = {
          config, remaining, key,
          transporter: isGmail ? null : nodemailer.createTransport({
            host: config.smtp_host, port: config.smtp_port, secure: config.smtp_port === 465,
            auth: { user: config.smtp_username, pass: config.smtp_password },
          }),
        };
      }
    }
    boxes.set(configId, box);
    return box;
  };

  const inWindow = (c: { send_days: number[]; send_window_start: string | null; send_window_end: string | null }, tz: string) => {
    const local = localParts(now, tz) ?? { day: dayOfWeek, minutes: minutesNow };
    if (!c.send_days.includes(local.day)) return false;
    if (c.send_window_start && c.send_window_end) {
      const [sh = 0, sm = 0] = c.send_window_start.split(":").map(Number);
      const [eh = 23, em = 59] = c.send_window_end.split(":").map(Number);
      if (local.minutes < sh * 60 + sm || local.minutes > eh * 60 + em) return false;
    }
    return true;
  };

  const byCampaign = new Map<string, typeof due>();
  for (const log of due) {
    if (!log.campaign_id || !log.contact_id) continue;
    const list = byCampaign.get(log.campaign_id) ?? [];
    list.push(log);
    byCampaign.set(log.campaign_id, list);
  }

  for (const [campaignId, logs] of byCampaign) {
    const first = logs[0];
    if (!first) continue;
    const campaign = first.campaigns as unknown as {
      prioritize_followups: boolean; breakup_day_exclusive: boolean; timezone: string | null;
      send_window_start: string | null; send_window_end: string | null; send_days: number[];
      config_id: string | null; rotation_config_ids: string[] | null; recipient_timezone: boolean; include_unsubscribe: boolean;
    };
    const pool = [...new Set([campaign.config_id, ...(campaign.rotation_config_ids ?? [])].filter(Boolean) as string[])];
    if (!pool.length) continue;
    const campaignTz = campaign.timezone || "UTC";
    if (!campaign.recipient_timezone && !inWindow(campaign, campaignTz)) continue;

    const order = (l: (typeof logs)[number]) =>
      (l.campaign_steps as unknown as { step_order: number } | null)?.step_order ?? 1;
    let sendable = logs;
    if (campaign.prioritize_followups) {
      sendable = [...logs].sort((a, b) => order(b) - order(a));
      if (campaign.breakup_day_exclusive) {
        const { data: lastStep } = await supabaseAdmin.from("campaign_steps").select("step_order")
          .eq("campaign_id", campaignId).order("step_order", { ascending: false }).limit(1).maybeSingle();
        const last = lastStep?.step_order ?? 0;
        if (last > 1 && sendable.some((l) => order(l) === last)) {
          const moved = sendable.filter((l) => order(l) > 1 && order(l) < last).map((l) => l.id);
          if (moved.length) {
            const next = new Date(now.getTime() + 86400_000).toISOString();
            for (let i = 0; i < moved.length; i += 100) {
              await supabaseAdmin.from("email_logs").update({ scheduled_at: next }).in("id", moved.slice(i, i + 100));
            }
          }
          sendable = sendable.filter((l) => order(l) === last);
        }
      }
    }

    // Recipient time zone: only contacts whose own local time is inside the window.
    if (campaign.recipient_timezone) {
      sendable = sendable.filter((l) => {
        const c = l.contacts as unknown as { custom_fields: Record<string, unknown> | null } | null;
        return inWindow(campaign, contactTimezone(c?.custom_fields) ?? campaignTz);
      });
    }
    if (!sendable.length) continue;
    // Never scan more than the pool could possibly send this run.
    sendable = sendable.slice(0, 200);

    const contactIds = [...new Set(sendable.map((l) => l.contact_id!))];
    const prior = new Map<string, { config_id: string | null; thread: string | null }>();
    for (let i = 0; i < contactIds.length; i += 100) {
      const { data } = await supabaseAdmin.from("email_logs").select("contact_id, config_id, gmail_thread_id, sent_at")
        .eq("campaign_id", campaignId).in("contact_id", contactIds.slice(i, i + 100)).not("sent_at", "is", null)
        .order("sent_at", { ascending: true });
      for (const r of data ?? []) if (r.contact_id && !prior.has(r.contact_id)) prior.set(r.contact_id, { config_id: r.config_id, thread: r.gmail_thread_id });
    }
    const userId = first.user_id;
    const emails = [...new Set(sendable.map((l) => (l.contacts as unknown as { email: string } | null)?.email?.toLowerCase()).filter(Boolean) as string[])];
    const suppressed = new Set<string>();
    for (let i = 0; i < emails.length; i += 100) {
      const { data } = await supabaseAdmin.from("suppressions").select("email").eq("user_id", userId).in("email", emails.slice(i, i + 100));
      for (const r of data ?? []) suppressed.add(r.email.toLowerCase());
    }
    const variantIds = [...new Set(sendable.map((l) => (l.campaign_steps as unknown as { variant_template_id: string | null } | null)?.variant_template_id).filter(Boolean) as string[])];
    const variants = new Map<string, { subject: string; body: string; attach_signature: boolean }>();
    if (variantIds.length) {
      const { data } = await supabaseAdmin.from("email_templates").select("id, subject, body, attach_signature").in("id", variantIds);
      for (const t of data ?? []) variants.set(t.id, t);
    }

    for (const log of sendable) {
      const poolBoxes = (await Promise.all(pool.map(getBox))).filter((b): b is Box => !!b);
      if (!poolBoxes.some((b) => b.remaining > 0)) break;
      const contact = log.contacts as unknown as {
        email: string; first_name: string; last_name: string; company: string; unsubscribed: boolean; custom_fields: Record<string, string> | null;
      } | null;
      const step = log.campaign_steps as unknown as {
        step_order: number; delay_days: number; variant_template_id: string | null;
        email_templates: { subject: string; body: string; attach_signature: boolean } | null;
      } | null;
      if (!contact || contact.unsubscribed || suppressed.has(contact.email.toLowerCase())) {
        await supabaseAdmin.from("email_logs").update({ status: "skipped", error: "Contact unsubscribed or on do-not-contact list" }).eq("id", log.id);
        continue;
      }
      const variantTemplate = step?.variant_template_id ? variants.get(step.variant_template_id) : undefined;
      const variant = variantTemplate ? (Math.random() < 0.5 ? "A" : "B") : null;
      const template = variant === "B" ? variantTemplate : step?.email_templates;
      if (!template) {
        await supabaseAdmin.from("email_logs").update({ status: "failed", error: "Template missing" }).eq("id", log.id);
        failed++;
        continue;
      }

      // Follow-ups stay on the mailbox (and thread) that sent the first email.
      const prev = prior.get(log.contact_id!);
      let box: Box | null | undefined;
      if (prev?.config_id) box = await getBox(prev.config_id);
      else box = poolBoxes.filter((b) => b.remaining > 0).sort((a, b) => b.remaining - a.remaining)[0];
      if (!box || box.remaining <= 0) continue;
      const config = box.config;

      const custom = (contact.custom_fields ?? {}) as Record<string, string>;
      const render = (text: string, html = false) => renderEmailVariables(spin(text), {
        ...custom, first_name: contact.first_name || "there", last_name: contact.last_name || "", company: contact.company || "", email: contact.email,
      }, html);
      const pixel = appUrl ? `<img src="${appUrl}/api/public/track/${log.id}.png" width="1" height="1" alt="" />` : "";
      const unsubUrl = appUrl && campaign.include_unsubscribe ? `${appUrl}/api/public/unsubscribe/${log.id}` : "";

      try {
        let fullBody = render(template.body, true);
        if (template.attach_signature) {
          const { data: sig } = await supabaseAdmin.from("user_signatures").select("signature").eq("user_id", log.user_id).maybeSingle();
          if (sig?.signature?.trim()) fullBody = appendSignature(fullBody, render(signatureHtml(sig.signature), true));
        }
        const prepared = await prepareEmail(fullBody, log.user_id, supabaseAdmin);
        const { trackCampaignLinks } = await import("@/server/campaign-tracking.server");
        const html = (appUrl ? await trackCampaignLinks(prepared.html, log.id, log.user_id, appUrl, supabaseAdmin) : prepared.html)
          + (unsubUrl ? unsubscribeFooter(unsubUrl) : "") + pixel;
        const headers = unsubUrl ? [`List-Unsubscribe: <${unsubUrl}>`, "List-Unsubscribe-Post: List-Unsubscribe=One-Click"] : [];
        let gmailIds: { id: string; threadId: string } | null = null;
        const subject = render(template.subject);
        if (config.provider === "gmail") {
          const threadId = prev?.config_id === config.id ? prev.thread : null;
          if (!box.key) throw new Error("Mailbox needs reconnecting");
          gmailIds = await gmailSend(box.key, {
            from: config.from_email, fromName: config.from_name, to: contact.email,
            subject: threadId && !/^re:/i.test(subject) ? `Re: ${subject}` : subject,
            html, attachments: prepared.attachments, threadId, headers,
          });
        } else {
          await box.transporter!.sendMail({
            from: config.from_name ? `"${config.from_name}" <${config.from_email}>` : config.from_email,
            to: contact.email, subject, html,
            headers: unsubUrl ? { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined,
            attachments: prepared.attachments.map((file) => ({ filename: file.filename, content: file.base64, encoding: "base64", contentType: file.contentType, cid: file.cid })),
          });
        }
        await supabaseAdmin.from("email_logs").update({
          status: "sent", sent_at: new Date().toISOString(), config_id: config.id, variant,
          gmail_message_id: gmailIds?.id ?? null, gmail_thread_id: gmailIds?.threadId ?? null,
        }).eq("id", log.id);
        sent++;
        box.remaining--;
        if (!prev) prior.set(log.contact_id!, { config_id: config.id, thread: gmailIds?.threadId ?? null });

        const { data: nextStep } = await supabaseAdmin.from("campaign_steps").select("id, delay_days")
          .eq("campaign_id", campaignId).eq("step_order", step!.step_order + 1).maybeSingle();
        if (nextStep) {
          const scheduled = new Date();
          scheduled.setDate(scheduled.getDate() + nextStep.delay_days);
          await supabaseAdmin.from("email_logs").upsert(
            { user_id: log.user_id, campaign_id: campaignId, step_id: nextStep.id, contact_id: log.contact_id, status: "queued", scheduled_at: scheduled.toISOString() },
            { onConflict: "campaign_id,step_id,contact_id", ignoreDuplicates: true },
          );
        }
        if (config.delay_seconds > 0 && box.remaining > 0) {
          await new Promise((r) => setTimeout(r, Math.min(config.delay_seconds, 50) * 1000));
        }
      } catch (err) {
        if (err instanceof ReconnectRequiredError) {
          await supabaseAdmin.from("email_configurations").update({ status: "reconnect" }).eq("id", config.id);
          box.remaining = 0;
          continue;
        }
        await supabaseAdmin.from("email_logs").update({ status: "failed", error: err instanceof Error ? err.message : "Send failed" }).eq("id", log.id);
        failed++;
      }
    }
  }

  // Mark campaigns completed when nothing is queued
  const { data: running } = await supabaseAdmin.from("campaigns").select("id").eq("status", "running");
  for (const c of running ?? []) {
    const { count } = await supabaseAdmin
      .from("email_logs")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", c.id)
      .eq("status", "queued");
    if ((count ?? 0) === 0) {
      await supabaseAdmin
        .from("campaigns")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", c.id);
    }
  }

  return { processed: due.length, sent, failed, replies };
}

function localParts(date: Date, timeZone: string): { day: number; minutes: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    const minutes = Number(get("hour")) * 60 + Number(get("minute"));
    if (day < 0 || Number.isNaN(minutes)) return null;
    return { day, minutes };
  } catch {
    return null;
  }
}
