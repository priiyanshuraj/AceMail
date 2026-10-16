import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Contact detail ----------

export const getContactDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: contact, error } = await db.from("contacts").select("*, contact_lists(name)").eq("id", data.id).single();
    if (error || !contact) throw new Error("Contact not found");
    const [logs, replies, tasks] = await Promise.all([
      db.from("email_logs").select("id, status, scheduled_at, sent_at, opened_at, replied_at, bounced_at, error, campaigns(name), campaign_steps(email_templates(subject))")
        .eq("contact_id", data.id).order("scheduled_at", { ascending: false }).limit(200),
      db.from("inbox_messages").select("id, subject, snippet, received_at, is_auto_reply").eq("contact_id", data.id).order("received_at", { ascending: false }).limit(100),
      db.from("linkedin_tasks").select("id, action, status, due_at, completed_at, message, linkedin_sequences(name)").eq("contact_id", data.id).order("due_at", { ascending: false }).limit(100),
    ]);
    const { contactLinkedinUrl } = await import("@/server/linkedin.server");
    return { contact: { ...contact, linkedin_url: contactLinkedinUrl(contact) }, logs: logs.data ?? [], replies: replies.data ?? [], tasks: tasks.data ?? [] };
  });

export const updateContactProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    first_name: z.string().max(200), last_name: z.string().max(200), company: z.string().max(300),
    title: z.string().max(300), phone: z.string().max(50),
    linkedin_url: z.string().max(500).refine((v) => v === "" || /^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(v), "Use a linkedin.com profile link"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("contacts").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Apollo enrichment ----------

export const getApolloStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { apolloKeyHint } = await import("@/server/apollo.server");
    return { hint: await apolloKeyHint(context.userId) };
  });

export const setApolloKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: z.string().trim().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const m = await import("@/server/apollo.server");
    if (!data.key) await m.deleteApolloKey(context.userId);
    else await m.saveApolloKey(context.userId, data.key);
    return { ok: true };
  });

async function enrichContacts(db: typeof import("@/integrations/supabase/client").supabase, userId: string, contacts: { id: string; first_name: string; last_name: string; company: string; email: string; linkedin_url: string; title: string; custom_fields: unknown }[]) {
  const { apolloBulkMatch } = await import("@/server/apollo.server");
  const { contactLinkedinUrl } = await import("@/server/linkedin.server");
  let matched = 0;
  for (let i = 0; i < contacts.length; i += 10) {
    const chunk = contacts.slice(i, i + 10);
    const matches = await apolloBulkMatch(userId, chunk.map((c) => ({ ...c, linkedin_url: contactLinkedinUrl(c) })));
    for (let j = 0; j < chunk.length; j++) {
      const c = chunk[j]!, m = matches[j];
      const patch: { [k in "enriched_at" | "title" | "linkedin_url" | "company" | "first_name" | "last_name" | "email"]?: string } = { enriched_at: new Date().toISOString() };
      if (m) {
        matched++;
        if (m.title && !c.title) patch.title = m.title;
        if (m.linkedin_url && !contactLinkedinUrl(c)) patch.linkedin_url = m.linkedin_url;
        if (m.organization?.name && !c.company) patch.company = m.organization.name;
        if (m.first_name && !c.first_name) patch.first_name = m.first_name;
        if (m.last_name && !c.last_name) patch.last_name = m.last_name;
        if (m.email && !m.email.includes("email_not_unlocked") && (!c.email || c.email.endsWith(".invalid"))) patch.email = m.email.toLowerCase();
      }
      await db.from("contacts").update(patch).eq("id", c.id);
    }
  }
  return matched;
}

export const enrichContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: c } = await context.supabase.from("contacts").select("*").eq("id", data.id).single();
    if (!c) throw new Error("Contact not found");
    return { matched: await enrichContacts(context.supabase, context.userId, [c]) };
  });

export const enrichList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ listId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase.from("contacts").select("*").eq("list_id", data.listId).is("enriched_at", null).limit(50);
    const matched = await enrichContacts(context.supabase, context.userId, rows ?? []);
    return { checked: rows?.length ?? 0, matched };
  });

// ---------- LinkedIn sequences ----------

const stepSchema = z.object({
  action: z.enum(["visit", "connect", "message", "follow", "endorse"]),
  delay_days: z.number().int().min(0).max(90),
  message: z.string().max(3000).optional(),
});

export const listLinkedinSequences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const { data: seqs, error } = await db.from("linkedin_sequences").select("*, contact_lists(name)").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const stats: Record<string, { pending: number; done: number; skipped: number; failed: number; byStep: Record<number, number> }> = {};
    for (const s of seqs ?? []) {
      const { data: t } = await db.from("linkedin_tasks").select("status, step_index").eq("sequence_id", s.id).limit(10000);
      const st = (stats[s.id] = { pending: 0, done: 0, skipped: 0, failed: 0, byStep: {} as Record<number, number> });
      for (const r of t ?? []) {
        st[r.status as "pending"]++;
        if (r.status === "done") st.byStep[r.step_index] = (st.byStep[r.step_index] ?? 0) + 1;
      }
    }
    return { sequences: seqs ?? [], stats };
  });

export const saveLinkedinSequence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(), name: z.string().trim().min(1).max(200), list_id: z.string().uuid(),
    mode: z.enum(["assisted", "runner"]), steps: z.array(stepSchema).min(1).max(15),
    daily_connect_limit: z.number().int().min(1).max(100), daily_message_limit: z.number().int().min(1).max(150),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...row } = data;
    const q = id
      ? context.supabase.from("linkedin_sequences").update(row).eq("id", id).select("id").single()
      : context.supabase.from("linkedin_sequences").insert({ ...row, user_id: context.userId }).select("id").single();
    const { data: saved, error } = await q;
    if (error) throw new Error(error.message);
    return saved;
  });

export const setLinkedinSequenceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.enum(["running", "paused"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: seq } = await db.from("linkedin_sequences").select("*").eq("id", data.id).single();
    if (!seq) throw new Error("Sequence not found");
    let added = 0;
    if (data.status === "running") {
      const { seedSequence } = await import("@/server/linkedin.server");
      added = await seedSequence(db, { ...seq, steps: seq.steps as never });
    }
    await db.from("linkedin_sequences").update({ status: data.status }).eq("id", data.id);
    return { added };
  });

export const deleteLinkedinSequence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("linkedin_sequences").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listLinkedinTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { dueTasks } = await import("@/server/linkedin.server");
    return dueTasks(context.supabase, context.userId, "assisted", 100);
  });

export const completeLinkedinTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.enum(["done", "skipped", "failed"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { finishTask } = await import("@/server/linkedin.server");
    await finishTask(context.supabase, data.id, data.status);
    return { ok: true };
  });

/** Contact replied on LinkedIn: stop their remaining LinkedIn steps and queued emails. */
export const markLinkedinReplied = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ contactId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    await db.from("linkedin_tasks").update({ status: "skipped", note: "Replied on LinkedIn" }).eq("contact_id", data.contactId).eq("status", "pending");
    await db.from("email_logs").update({ status: "skipped", error: "Replied on LinkedIn" }).eq("contact_id", data.contactId).eq("status", "queued");
    return { ok: true };
  });

export const getRunnerToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("linkedin_runner_tokens").select("created_at, last_used_at").eq("user_id", context.userId).maybeSingle();
    return data;
  });

export const createRunnerToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sha256 } = await import("@/server/linkedin.server");
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = "acr_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("linkedin_runner_tokens").upsert({ user_id: context.userId, token_hash: await sha256(token), created_at: new Date().toISOString(), last_used_at: null });
    if (error) throw new Error(error.message);
    return { token };
  });

export const revokeRunnerToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("linkedin_runner_tokens").delete().eq("user_id", context.userId);
    return { ok: true };
  });

// ---------- Inbox thread + reply ----------

type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[]; headers?: { name: string; value: string }[] };
const decode = (d: string) => {
  const bin = atob(d.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};
function findBody(p: Part | undefined, type: string): string {
  if (!p) return "";
  if (p.mimeType === type && p.body?.data) return decode(p.body.data);
  for (const c of p.parts ?? []) { const r = findBody(c, type); if (r) return r; }
  return "";
}

async function loadInboxBox(db: typeof import("@/integrations/supabase/client").supabase, id: string) {
  const { data: msg } = await db.from("inbox_messages").select("id, gmail_thread_id, subject, from_email, config_id, email_configurations(from_email, from_name)").eq("id", id).single();
  if (!msg?.gmail_thread_id) throw new Error("Conversation not found");
  const { getMailboxKey } = await import("@/server/gmail.server");
  const key = msg.config_id ? await getMailboxKey(msg.config_id) : null;
  if (!key) throw new Error("Mailbox needs to be reconnected");
  return { msg, key };
}

export const getInboxThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { msg, key } = await loadInboxBox(context.supabase, data.id);
    const { gmailCall } = await import("@/server/gmail.server");
    const thread = await gmailCall(key, `/gmail/v1/users/me/threads/${msg.gmail_thread_id}?format=full`);
    await context.supabase.from("inbox_messages").update({ is_read: true }).eq("id", data.id);
    return (thread.messages ?? []).map((m: { id: string; internalDate?: string; payload?: Part; snippet?: string }) => {
      const h = m.payload?.headers ?? [];
      const get = (n: string) => h.find((x) => x.name.toLowerCase() === n)?.value ?? "";
      const html = findBody(m.payload, "text/html");
      const text = findBody(m.payload, "text/plain") || m.snippet || "";
      return { id: m.id, from: get("from"), date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : "", subject: get("subject"), html, text };
    });
  });

export const replyToInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), body: z.string().min(1).max(200000), includeSignature: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { msg, key } = await loadInboxBox(supabase, data.id);
    const box = msg.email_configurations as unknown as { from_email: string; from_name: string };
    const { gmailCall, gmailSend } = await import("@/server/gmail.server");
    const thread = await gmailCall(key, `/gmail/v1/users/me/threads/${msg.gmail_thread_id}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References`);
    const last = (thread.messages ?? []).at(-1) as { payload?: Part } | undefined;
    const hv = (n: string) => last?.payload?.headers?.find((x) => x.name.toLowerCase() === n)?.value ?? "";
    const mid = hv("message-id");
    const { prepareEmail } = await import("@/server/email-content.server");
    const { appendSignature, signatureHtml } = await import("@/lib/email-content");
    let body = data.body;
    if (data.includeSignature) {
      const { data: sig } = await supabase.from("user_signatures").select("signature").eq("user_id", userId).maybeSingle();
      if (sig?.signature) body = appendSignature(body, signatureHtml(sig.signature));
    }
    const prepared = await prepareEmail(body, userId, supabase);
    const subject = /^re:/i.test(msg.subject) ? msg.subject : `Re: ${msg.subject}`;
    const sent = await gmailSend(key, {
      from: box.from_email, fromName: box.from_name, to: msg.from_email, subject, html: prepared.html, attachments: prepared.attachments,
      threadId: msg.gmail_thread_id, headers: mid ? [`In-Reply-To: ${mid}`, `References: ${[hv("references"), mid].filter(Boolean).join(" ")}`] : [],
    });
    await supabase.from("email_logs").insert({
      user_id: userId, status: "sent", sent_at: new Date().toISOString(), gmail_message_id: sent.id, gmail_thread_id: sent.threadId,
      direct_to: msg.from_email, direct_subject: subject, config_id: msg.config_id,
    });
    return { ok: true };
  });

// ---------- Campaign funnel ----------

export const getCampaignFunnel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ campaignId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: steps } = await db.from("campaign_steps").select("id, step_order").eq("campaign_id", data.campaignId).order("step_order");
    const order = new Map((steps ?? []).map((s) => [s.id, s.step_order]));
    // Furthest step + state per contact
    const per = new Map<string, { step: number; state: string; email: string; name: string }>();
    for (let from = 0; ; from += 1000) {
      const { data: logs } = await db.from("email_logs").select("contact_id, step_id, status, sent_at, recipient_email, contacts(email, first_name, last_name)")
        .eq("campaign_id", data.campaignId).order("id").range(from, from + 999);
      for (const l of logs ?? []) {
        if (!l.contact_id || !l.step_id) continue;
        const step = order.get(l.step_id) ?? 0;
        const c = l.contacts as unknown as { email: string; first_name: string; last_name: string } | null;
        const state = l.status === "replied" ? "replied" : l.status === "bounced" ? "bounced" : l.status === "failed" ? "failed"
          : l.status === "skipped" ? "stopped" : l.sent_at ? "sent" : "waiting";
        const prev = per.get(l.contact_id);
        const terminal = (s: string) => s === "replied" || s === "bounced";
        if (!prev || (l.sent_at && step > prev.step && !terminal(prev.state)) || terminal(state) || (prev.state === "waiting" && l.sent_at)) {
          per.set(l.contact_id, { step: l.sent_at || !prev ? step : prev.step, state, email: c?.email ?? l.recipient_email ?? "", name: c ? `${c.first_name} ${c.last_name}`.trim() : "" });
        }
      }
      if (!logs || logs.length < 1000) break;
    }
    const funnel = (steps ?? []).map((s) => {
      const people = [...per.entries()].filter(([, v]) => v.step === s.step_order).map(([id, v]) => ({ id, ...v }));
      const counts: Record<string, number> = {};
      for (const p of people) counts[p.state] = (counts[p.state] ?? 0) + 1;
      return { step: s.step_order, total: people.length, counts, people: people.slice(0, 500) };
    });
    return { funnel, contacts: per.size };
  });

// ---------- LinkedIn tracker ----------

export const getLinkedinTracker = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const since = new Date(Date.now() - 13 * 86400_000); since.setUTCHours(0, 0, 0, 0);
    const [{ data: tasks }, { data: token }] = await Promise.all([
      db.from("linkedin_tasks").select("id, action, status, note, completed_at, due_at, contact_id, contacts(first_name, last_name, company), linkedin_sequences(name, mode)")
        .neq("status", "pending").gte("completed_at", since.toISOString()).order("completed_at", { ascending: false }).limit(2000),
      db.from("linkedin_runner_tokens").select("last_used_at").eq("user_id", context.userId).maybeSingle(),
    ]);
    const { count: waiting } = await db.from("linkedin_tasks").select("id", { count: "exact", head: true }).eq("status", "pending");
    const totals = { visit: 0, connect: 0, message: 0, follow: 0, endorse: 0, replied: 0, failed: 0, skipped: 0 };
    const days: Record<string, number> = {};
    for (let i = 0; i < 14; i++) days[new Date(since.getTime() + i * 86400_000).toISOString().slice(0, 10)] = 0;
    for (const t of tasks ?? []) {
      if (t.status === "done") { totals[t.action as "visit"]++; const d = (t.completed_at ?? "").slice(0, 10); if (d in days) days[d] = (days[d] ?? 0) + 1; }
      else if (t.note?.startsWith("Replied")) totals.replied++;
      else if (t.status === "failed") totals.failed++;
      else totals.skipped++;
    }
    const lastSeen = token?.last_used_at ?? null;
    return {
      totals, waiting: waiting ?? 0, days: Object.entries(days).map(([day, n]) => ({ day, n })),
      runner: { hasKey: !!token, lastSeen, online: !!lastSeen && Date.now() - new Date(lastSeen).getTime() < 10 * 60_000 },
      recent: (tasks ?? []).slice(0, 50),
    };
  });
