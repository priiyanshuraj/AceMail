import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabaseForUser } from "../supabase";

const typed = (sb: ReturnType<typeof supabaseForUser>) => sb as unknown as SupabaseClient<Database>;
const out = <T extends Record<string, unknown>>(v: T) => ({ content: [{ type: "text" as const, text: JSON.stringify(v) }], structuredContent: v });

export const listLinkedinSequences = defineTool({
  name: "list_linkedin_sequences",
  title: "List LinkedIn sequences",
  description: "List LinkedIn sequences with mode (assisted/manual or runner/automated), status, daily limits, steps and task counts.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_i, ctx) => {
    const db = typed(supabaseForUser(ctx));
    const { data, error } = await db.from("linkedin_sequences").select("id, name, mode, status, list_id, daily_connect_limit, daily_message_limit, steps, created_at").order("created_at", { ascending: false }).limit(200);
    if (error) throw new ToolError(error.message);
    const sequences = [];
    for (const s of data ?? []) {
      const { data: t } = await db.from("linkedin_tasks").select("status").eq("sequence_id", s.id).limit(10000);
      const counts: Record<string, number> = {};
      for (const r of t ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
      sequences.push({ id: s.id, name: s.name, mode: s.mode, status: s.status, list_id: s.list_id, daily_connect_limit: s.daily_connect_limit, daily_message_limit: s.daily_message_limit, steps: JSON.stringify(s.steps), task_counts: counts });
    }
    return out({ sequences });
  },
});

export const setLinkedinSequenceStatus = defineTool({
  name: "set_linkedin_sequence_status",
  title: "Start or pause LinkedIn sequence",
  description: "Start (running) or pause a LinkedIn sequence. Starting schedules steps for contacts with a LinkedIn profile link.",
  inputSchema: { sequence_id: z.string().uuid(), status: z.enum(["running", "paused"]) },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ sequence_id, status }, ctx) => {
    const db = typed(supabaseForUser(ctx));
    const { data: seq } = await db.from("linkedin_sequences").select("*").eq("id", sequence_id).maybeSingle();
    if (!seq) throw new ToolError("Sequence not found");
    let added = 0;
    if (status === "running") {
      const { seedSequence } = await import("@/server/linkedin.server");
      added = await seedSequence(db, { ...seq, steps: seq.steps as never });
    }
    const { error } = await db.from("linkedin_sequences").update({ status }).eq("id", sequence_id);
    if (error) throw new ToolError(error.message);
    return out({ status, tasks_added: added });
  },
});

export const listLinkedinTasks = defineTool({
  name: "list_linkedin_tasks",
  title: "List LinkedIn tasks",
  description: "List LinkedIn steps (visit, connect, message, follow, endorse) with contact, profile link and personalized message. Defaults to pending.",
  inputSchema: {
    status: z.enum(["pending", "done", "skipped", "failed"]).default("pending"),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    const db = typed(supabaseForUser(ctx));
    const { data, error } = await db.from("linkedin_tasks")
      .select("id, action, status, due_at, completed_at, message, note, contact_id, contacts(first_name, last_name, company, linkedin_url), linkedin_sequences(name, mode)")
      .eq("status", status).order(status === "pending" ? "due_at" : "completed_at", { ascending: status === "pending" }).limit(limit);
    if (error) throw new ToolError(error.message);
    const tasks = (data ?? []).map((t) => ({
      id: t.id, action: t.action, status: t.status, due_at: t.due_at, completed_at: t.completed_at, message: t.message, note: t.note, contact_id: t.contact_id,
      contact: t.contacts ? `${t.contacts.first_name} ${t.contacts.last_name}`.trim() : null, company: t.contacts?.company ?? null, linkedin_url: t.contacts?.linkedin_url ?? null,
      sequence: t.linkedin_sequences?.name ?? null, mode: t.linkedin_sequences?.mode ?? null,
    }));
    return out({ tasks });
  },
});

export const completeLinkedinTask = defineTool({
  name: "complete_linkedin_task",
  title: "Mark LinkedIn task",
  description: "Mark a LinkedIn task done, skipped or failed after the user did it manually. Done schedules the contact's next step.",
  inputSchema: { task_id: z.string().uuid(), status: z.enum(["done", "skipped", "failed"]), note: z.string().max(500).optional() },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ task_id, status, note }, ctx) => {
    const db = typed(supabaseForUser(ctx));
    const { finishTask } = await import("@/server/linkedin.server");
    await finishTask(db, task_id, status, note);
    return out({ ok: true });
  },
});

export const markLinkedinReplied = defineTool({
  name: "mark_linkedin_replied",
  title: "Contact replied on LinkedIn",
  description: "Stop a contact's remaining LinkedIn steps and queued emails because they replied on LinkedIn.",
  inputSchema: { contact_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ contact_id }, ctx) => {
    const db = typed(supabaseForUser(ctx));
    await db.from("linkedin_tasks").update({ status: "skipped", note: "Replied on LinkedIn", completed_at: new Date().toISOString() }).eq("contact_id", contact_id).eq("status", "pending");
    await db.from("email_logs").update({ status: "skipped", error: "Replied on LinkedIn" } as never).eq("contact_id", contact_id).eq("status", "queued");
    return out({ ok: true });
  },
});

export const getLinkedinActivity = defineTool({
  name: "get_linkedin_activity",
  title: "LinkedIn activity",
  description: "Totals of LinkedIn actions (visits, connects, messages, follows, replies, failures) over the last N days, plus pending count.",
  inputSchema: { days: z.number().int().min(1).max(90).default(14) },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days }, ctx) => {
    const db = typed(supabaseForUser(ctx));
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const { data, error } = await db.from("linkedin_tasks").select("action, status, note").neq("status", "pending").gte("completed_at", since).limit(5000);
    if (error) throw new ToolError(error.message);
    const totals: Record<string, number> = { visit: 0, connect: 0, message: 0, follow: 0, replied: 0, failed: 0, skipped: 0 };
    for (const t of data ?? []) {
      if (t.status === "done") totals[t.action] = (totals[t.action] ?? 0) + 1;
      else if (t.status === "failed") totals.failed++;
      else totals.skipped++;
      if (t.note && /replied/i.test(t.note)) totals.replied++;
    }
    const { count } = await db.from("linkedin_tasks").select("id", { count: "exact", head: true }).eq("status", "pending");
    return out({ days, totals, pending: count ?? 0 });
  },
});

export const getContactDetail = defineTool({
  name: "get_contact_detail",
  title: "Contact detail",
  description: "One contact's profile (name, company, title, phone, LinkedIn, custom fields) with their email history and LinkedIn steps.",
  inputSchema: { contact_id: z.string().uuid() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ contact_id }, ctx) => {
    const db = typed(supabaseForUser(ctx));
    const { data: c, error } = await db.from("contacts").select("id, email, first_name, last_name, company, title, phone, linkedin_url, list_id, custom_fields, email_status, unsubscribed").eq("id", contact_id).maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!c) throw new ToolError("Contact not found");
    const [{ data: emails }, { data: li }] = await Promise.all([
      db.from("email_logs").select("id, status, subject, sent_at, opened_at, campaign_id").eq("contact_id", contact_id).order("created_at", { ascending: false }).limit(100),
      db.from("linkedin_tasks").select("id, action, status, due_at, completed_at, note").eq("contact_id", contact_id).order("due_at", { ascending: false }).limit(100),
    ]);
    return out({ contact: { ...c, custom_fields: JSON.stringify(c.custom_fields ?? {}) }, emails: emails ?? [], linkedin: li ?? [] });
  },
});

export const updateContactProfile = defineTool({
  name: "update_contact_profile",
  title: "Update contact profile",
  description: "Set a contact's job title, phone or LinkedIn profile link (needed for LinkedIn sequences).",
  inputSchema: {
    contact_id: z.string().uuid(),
    title: z.string().max(300).optional(),
    phone: z.string().max(50).optional(),
    linkedin_url: z.string().max(500).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ contact_id, ...patch }, ctx) => {
    const db = typed(supabaseForUser(ctx));
    const { error } = await db.from("contacts").update(patch).eq("id", contact_id);
    if (error) throw new ToolError(error.message);
    return out({ ok: true });
  },
});
