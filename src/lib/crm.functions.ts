import type { Database } from "@/integrations/supabase/types";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DEFAULT_STAGES = [
  { name: "New", color: "slate", position: 0 },
  { name: "Contacted", color: "blue", position: 1 },
  { name: "Replied", color: "amber", position: 2 },
  { name: "Meeting booked", color: "violet", position: 3 },
  { name: "Proposal", color: "orange", position: 4 },
  { name: "Won", color: "green", position: 5, is_won: true },
  { name: "Lost", color: "red", position: 6, is_lost: true },
];

type Db = typeof import("@/integrations/supabase/client").supabase;

async function ensureStages(db: Db, userId: string) {
  const { data: stages, error } = await db.from("crm_stages").select("*").eq("user_id", userId).order("position");
  if (error) throw new Error(error.message);
  if (stages && stages.length > 0) return stages;
  const { data: created, error: insErr } = await db.from("crm_stages").insert(DEFAULT_STAGES.map((s) => ({ ...s, user_id: userId }))).select();
  if (insErr) throw new Error(insErr.message);
  return (created ?? []).sort((a, b) => a.position - b.position);
}

// ---------- Pipeline board ----------

export const getPipeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const stages = await ensureStages(db, context.userId);
    const { data: deals, error } = await db
      .from("crm_deals")
      .select("*, contacts(email, first_name, last_name, company)")
      .eq("user_id", context.userId)
      .order("position");
    if (error) throw new Error(error.message);
    return { stages, deals: deals ?? [] };
  });

export const createDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      contact_id: z.string().uuid(),
      title: z.string().max(300).default(""),
      value: z.number().min(0).default(0),
      currency: z.string().max(8).default("USD"),
      expected_close: z.string().nullable().default(null),
      stage_id: z.string().uuid().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const stages = await ensureStages(db, context.userId);
    const stageId = data.stage_id ?? stages.find((s) => !s.is_won && !s.is_lost)?.id ?? stages[0]!.id;
    const { error } = await db.from("crm_deals").insert({
      user_id: context.userId,
      contact_id: data.contact_id,
      stage_id: stageId,
      title: data.title,
      value: data.value,
      currency: data.currency,
      expected_close: data.expected_close,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().max(300).optional(),
      value: z.number().min(0).optional(),
      currency: z.string().max(8).optional(),
      expected_close: z.string().nullable().optional(),
      stage_id: z.string().uuid().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const patch = { ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)), updated_at: new Date().toISOString() } as Database["public"]["Tables"]["crm_deals"]["Update"];
    const { error } = await context.supabase.from("crm_deals").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), stage_id: z.string().uuid(), position: z.number().int().default(0) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("crm_deals")
      .update({ stage_id: data.stage_id, position: data.position, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("crm_deals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Stages ----------

export const addStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().trim().min(1).max(60), color: z.string().max(20).default("slate") }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const stages = await ensureStages(db, context.userId);
    const maxPos = Math.max(...stages.filter((s) => !s.is_won && !s.is_lost).map((s) => s.position), -1);
    const { error } = await db.from("crm_stages").insert({ user_id: context.userId, name: data.name, color: data.color, position: maxPos + 1 });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(60), color: z.string().max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("crm_stages").update({ name: data.name, color: data.color }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { count } = await db.from("crm_deals").select("id", { count: "exact", head: true }).eq("stage_id", data.id);
    if ((count ?? 0) > 0) throw new Error("Move the deals out of this stage first");
    const { error } = await db.from("crm_stages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Client board ----------

export const getClientBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const stages = await ensureStages(db, context.userId);
    const { data: deals, error } = await db
      .from("crm_deals")
      .select("id, stage_id, title, value, currency, expected_close, updated_at, contacts(id, email, first_name, last_name, company, title)")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: notes } = await db.from("crm_notes").select("id, contact_id, body, remind_at, done").eq("user_id", context.userId).eq("done", false).not("remind_at", "is", null);
    return { stages, deals: deals ?? [], reminders: notes ?? [] };
  });

// ---------- Client detail ----------

export const getCrmClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ contact_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const stages = await ensureStages(db, context.userId);
    const { data: contact, error } = await db.from("contacts").select("*, contact_lists(name)").eq("id", data.contact_id).single();
    if (error || !contact) throw new Error("Contact not found");
    const [deals, notes, logs, replies, tasks] = await Promise.all([
      db.from("crm_deals").select("*").eq("contact_id", data.contact_id).order("updated_at", { ascending: false }),
      db.from("crm_notes").select("*").eq("contact_id", data.contact_id).order("created_at", { ascending: false }).limit(200),
      db.from("email_logs").select("id, status, scheduled_at, sent_at, opened_at, replied_at, bounced_at, direct_subject, campaigns(name)").eq("contact_id", data.contact_id).order("scheduled_at", { ascending: false }).limit(100),
      db.from("inbox_messages").select("id, subject, snippet, received_at, is_auto_reply").eq("contact_id", data.contact_id).order("received_at", { ascending: false }).limit(50),
      db.from("linkedin_tasks").select("id, action, status, due_at, completed_at, linkedin_sequences(name)").eq("contact_id", data.contact_id).order("due_at", { ascending: false }).limit(50),
    ]);
    return {
      contact,
      stages,
      deals: deals.data ?? [],
      notes: notes.data ?? [],
      logs: logs.data ?? [],
      replies: replies.data ?? [],
      tasks: tasks.data ?? [],
    };
  });

// ---------- Notes & reminders ----------

export const addNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      contact_id: z.string().uuid(),
      deal_id: z.string().uuid().nullable().default(null),
      body: z.string().trim().min(1).max(5000),
      remind_at: z.string().nullable().default(null),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("crm_notes").insert({ ...data, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), done: z.boolean().optional(), body: z.string().trim().min(1).max(5000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const patch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) as Database["public"]["Tables"]["crm_notes"]["Update"];
    const { error } = await context.supabase.from("crm_notes").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("crm_notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Contact picker for new deals ----------

export const searchContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ q: z.string().max(200).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    let q = db.from("contacts").select("id, email, first_name, last_name, company").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(20);
    if (data.q) q = q.or(`email.ilike.%${data.q}%,first_name.ilike.%${data.q}%,last_name.ilike.%${data.q}%,company.ilike.%${data.q}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
