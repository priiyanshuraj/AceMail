// Server-only Gmail mailbox helpers (per-user connection via the connector gateway).
import { callAsAppUser, appUserReconnectRequired } from "@/integrations/lovable/appUserConnector";
import { encryptConnectionKey, decryptConnectionKey } from "@/server/connectionKeyCrypto";
import type { EmailAttachment } from "@/server/email-content.server";

export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
export const GMAIL_CONNECTOR = "google_mail";
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
];

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export async function saveMailboxKey(configId: string, userId: string, key: string, appUserId?: string) {
  const db = await admin();
  const { error } = await db.from("mailbox_credentials").upsert({
    config_id: configId,
    user_id: userId,
    connection_key_ciphertext: encryptConnectionKey(key),
    app_user_id: appUserId ?? userId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function getMailboxKey(configId: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db
    .from("mailbox_credentials")
    .select("connection_key_ciphertext")
    .eq("config_id", configId)
    .maybeSingle();
  return data ? decryptConnectionKey(data.connection_key_ciphertext) : null;
}

export async function getAnyUserGmailKey(userId: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db
    .from("mailbox_credentials")
    .select("connection_key_ciphertext")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data ? decryptConnectionKey(data.connection_key_ciphertext) : null;
}

export class ReconnectRequiredError extends Error {}

export async function gmailCall(key: string, path: string, init?: RequestInit) {
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey: key,
    connectorId: GMAIL_CONNECTOR,
    path,
    init,
    requiredScopes: GMAIL_SCOPES,
  });
  if (await appUserReconnectRequired(res)) throw new ReconnectRequiredError("Mailbox needs to be reconnected");
  if (!res.ok) throw new Error(`Gmail request failed [${res.status}]: ${await res.text()}`);
  return res.json();
}

const b64 = (s: string) =>
  btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const header = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);

export async function gmailSend(
  key: string,
  opts: { from: string; fromName?: string; to: string; subject: string; html: string; threadId?: string | null; attachments?: EmailAttachment[] },
): Promise<{ id: string; threadId: string }> {
  const from = opts.fromName ? `${header(opts.fromName)} <${opts.from}>` : opts.from;
  const boundary = `acemail_${crypto.randomUUID()}`;
  const files = opts.attachments ?? [];
  const content = files.length ? [
    `--${boundary}`, 'Content-Type: text/html; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", b64(opts.html),
    ...files.flatMap((file) => [
      `--${boundary}`, `Content-Type: ${file.contentType.replace(/[\r\n]/g, "")}`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: ${file.cid ? "inline" : "attachment"}; filename="${file.filename.replace(/["\r\n]/g, "_")}"`,
      ...(file.cid ? [`Content-ID: <${file.cid}>`] : []), "", file.base64.match(/.{1,76}/g)?.join("\r\n") ?? "",
    ]), `--${boundary}--`,
  ].join("\r\n") : opts.html;
  const msg = [
    `From: ${from}`,
    `To: ${opts.to}`,
    `Subject: ${header(opts.subject)}`,
    "MIME-Version: 1.0",
    files.length ? `Content-Type: multipart/mixed; boundary="${boundary}"` : 'Content-Type: text/html; charset="UTF-8"',
    "",
    content,
  ].join("\r\n");
  const raw = b64(msg).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return gmailCall(key, "/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts.threadId ? { raw, threadId: opts.threadId } : { raw }),
  });
}

type Hdr = { name: string; value: string };

/** Pull recent inbox messages, match them to campaign threads, mark replies and stop follow-ups. */
export async function syncMailboxReplies(configId: string, userId: string, ownEmail: string) {
  const db = await admin();
  const key = await getMailboxKey(configId);
  if (!key) return { synced: 0 };
  let list: { messages?: { id: string; threadId: string }[] };
  try {
    list = await gmailCall(key, `/gmail/v1/users/me/messages?maxResults=25&q=${encodeURIComponent("in:inbox newer_than:3d")}`);
  } catch (e) {
    if (e instanceof ReconnectRequiredError) {
      await db.from("email_configurations").update({ status: "reconnect" }).eq("id", configId);
      return { synced: 0 };
    }
    throw e;
  }
  const msgs = list.messages ?? [];
  if (msgs.length === 0) {
    await db.from("email_configurations").update({ last_synced_at: new Date().toISOString() }).eq("id", configId);
    return { synced: 0 };
  }
  const threadIds = [...new Set(msgs.map((m) => m.threadId))];
  const { data: logs } = await db
    .from("email_logs")
    .select("id, campaign_id, contact_id, gmail_thread_id, replied_at")
    .eq("user_id", userId)
    .in("gmail_thread_id", threadIds);
  const byThread = new Map((logs ?? []).map((l) => [l.gmail_thread_id!, l]));
  const { data: existing } = await db
    .from("inbox_messages")
    .select("gmail_message_id")
    .eq("config_id", configId)
    .in("gmail_message_id", msgs.map((m) => m.id));
  const seen = new Set((existing ?? []).map((e) => e.gmail_message_id));

  let synced = 0;
  for (const m of msgs) {
    const log = byThread.get(m.threadId);
    if (!log || seen.has(m.id)) continue;
    const detail = await gmailCall(
      key,
      `/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
    );
    const hdrs: Hdr[] = detail.payload?.headers ?? [];
    const fromRaw = hdrs.find((h) => h.name === "From")?.value ?? "";
    const match = fromRaw.match(/^(.*?)\s*<(.+)>$/);
    const fromEmail = (match?.[2] ?? fromRaw).trim().toLowerCase();
    if (fromEmail === ownEmail.toLowerCase()) continue;
    await db.from("inbox_messages").upsert(
      {
        user_id: userId,
        config_id: configId,
        log_id: log.id,
        campaign_id: log.campaign_id,
        contact_id: log.contact_id,
        gmail_message_id: m.id,
        gmail_thread_id: m.threadId,
        from_email: fromEmail,
        from_name: (match?.[1] ?? "").replace(/"/g, "").trim(),
        subject: hdrs.find((h) => h.name === "Subject")?.value ?? "",
        snippet: detail.snippet ?? "",
        received_at: detail.internalDate ? new Date(Number(detail.internalDate)).toISOString() : new Date().toISOString(),
      },
      { onConflict: "config_id,gmail_message_id", ignoreDuplicates: true },
    );
    if (!log.replied_at) {
      await db.from("email_logs").update({ status: "replied", replied_at: new Date().toISOString() }).eq("id", log.id);
      // Auto-stop: cancel remaining follow-ups for this contact in this campaign
      if (log.campaign_id && log.contact_id) {
        await db
          .from("email_logs")
          .update({ status: "skipped", error: "Contact replied" })
          .eq("campaign_id", log.campaign_id)
          .eq("contact_id", log.contact_id)
          .eq("status", "queued");
      }
    }
    synced++;
  }
  await db.from("email_configurations").update({ last_synced_at: new Date().toISOString(), status: "active" }).eq("id", configId);
  return { synced };
}

/** Effective daily cap: warmup ramps from start volume by `increment` per day up to daily_limit. */
export function effectiveDailyLimit(c: {
  daily_limit: number;
  warmup_enabled: boolean;
  warmup_start_volume: number;
  warmup_increment: number;
  warmup_started_at: string | null;
}) {
  if (!c.warmup_enabled || !c.warmup_started_at) return c.daily_limit;
  const days = Math.floor((Date.now() - new Date(c.warmup_started_at).getTime()) / 86400000);
  return Math.min(c.daily_limit, c.warmup_start_volume + c.warmup_increment * days);
}
