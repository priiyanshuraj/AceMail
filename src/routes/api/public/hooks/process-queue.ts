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
  const nodemailer = (await import("nodemailer")).default;

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  // Fetch due queued logs with campaign + config context
  const { data: due, error } = await supabaseAdmin
    .from("email_logs")
    .select(
      "id, campaign_id, step_id, contact_id, user_id, campaigns!inner(status, send_window_start, send_window_end, send_days, config_id, email_configurations(*)), contacts(email, first_name, last_name, company, unsubscribed), campaign_steps(step_order, delay_days, email_templates(subject, body))"
    )
    .eq("status", "queued")
    .eq("campaigns.status", "running")
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (error) throw new Error(error.message);
  if (!due || due.length === 0) return { processed: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  // Group by campaign to reuse transporters and enforce daily limits
  const byCampaign = new Map<string, typeof due>();
  for (const log of due) {
    const list = byCampaign.get(log.campaign_id) ?? [];
    list.push(log);
    byCampaign.set(log.campaign_id, list);
  }

  for (const [campaignId, logs] of byCampaign) {
    const first = logs[0];
    if (!first) continue;
    const campaign = first.campaigns as unknown as {
      status: string;
      send_window_start: string | null;
      send_window_end: string | null;
      send_days: number[];
      config_id: string | null;
      email_configurations: {
        smtp_host: string;
        smtp_port: number;
        smtp_username: string;
        smtp_password: string;
        from_email: string;
        from_name: string;
        daily_limit: number;
        delay_seconds: number;
      } | null;
    };
    const config = campaign.email_configurations;
    if (!config) continue;

    // Send window / day checks
    if (!campaign.send_days.includes(dayOfWeek)) continue;
    if (campaign.send_window_start && campaign.send_window_end) {
      const [sh = 0, sm = 0] = campaign.send_window_start.split(":").map(Number);
      const [eh = 23, em = 59] = campaign.send_window_end.split(":").map(Number);
      if (minutesNow < sh * 60 + sm || minutesNow > eh * 60 + em) continue;
    }

    // Daily limit: count emails sent today for this campaign
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const { count: sentToday } = await supabaseAdmin
      .from("email_logs")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", ["sent", "opened"])
      .gte("sent_at", dayStart.toISOString());
    const remaining = Math.max(0, config.daily_limit - (sentToday ?? 0));
    if (remaining === 0) continue;

    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_port === 465,
      auth: { user: config.smtp_username, pass: config.smtp_password },
    });

    const appUrl = process.env["APP_URL"] ?? "";

    for (const log of logs.slice(0, remaining)) {
      const contact = log.contacts as unknown as {
        email: string;
        first_name: string;
        last_name: string;
        company: string;
        unsubscribed: boolean;
      } | null;
      const step = log.campaign_steps as unknown as {
        step_order: number;
        delay_days: number;
        email_templates: { subject: string; body: string } | null;
      } | null;
      const template = step?.email_templates;

      if (!contact || contact.unsubscribed || !template) {
        await supabaseAdmin
          .from("email_logs")
          .update({ status: "failed", error: "Contact unsubscribed or template missing" })
          .eq("id", log.id);
        failed++;
        continue;
      }

      const render = (text: string) =>
        text
          .replaceAll("{{first_name}}", contact.first_name || "there")
          .replaceAll("{{last_name}}", contact.last_name || "")
          .replaceAll("{{company}}", contact.company || "")
          .replaceAll("{{email}}", contact.email);

      const pixel = appUrl
        ? `<img src="${appUrl}/api/public/track/${log.id}.png" width="1" height="1" alt="" />`
        : "";

      try {
        await transporter.sendMail({
          from: config.from_name ? `"${config.from_name}" <${config.from_email}>` : config.from_email,
          to: contact.email,
          subject: render(template.subject),
          html: render(template.body).replace(/\n/g, "<br />") + pixel,
        });
        await supabaseAdmin
          .from("email_logs")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", log.id);
        sent++;

        // Enqueue next step
        const { data: nextStep } = await supabaseAdmin
          .from("campaign_steps")
          .select("id, delay_days")
          .eq("campaign_id", campaignId)
          .eq("step_order", step!.step_order + 1)
          .maybeSingle();
        if (nextStep) {
          const scheduled = new Date();
          scheduled.setDate(scheduled.getDate() + nextStep.delay_days);
          await supabaseAdmin.from("email_logs").upsert(
            {
              user_id: log.user_id,
              campaign_id: campaignId,
              step_id: nextStep.id,
              contact_id: log.contact_id,
              status: "queued",
              scheduled_at: scheduled.toISOString(),
            },
            { onConflict: "campaign_id,step_id,contact_id", ignoreDuplicates: true }
          );
        }

        // Delay between sends (rate limiting), capped for worker runtime
        if (config.delay_seconds > 0) {
          await new Promise((r) => setTimeout(r, Math.min(config.delay_seconds, 5) * 1000));
        }
      } catch (err) {
        await supabaseAdmin
          .from("email_logs")
          .update({ status: "failed", error: err instanceof Error ? err.message : "Send failed" })
          .eq("id", log.id);
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

  return { processed: due.length, sent, failed };
}
