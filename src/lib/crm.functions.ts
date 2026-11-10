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
  const { data: created, error: insErr } = await db.from("crm_stages").insert(DEFAULT_STAGES.map((s) => ({ is_won: false, is_lost: false, ...s, user_id: userId }))).select();
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
      lost_reason: z.string().max(500).nullable().optional(),
      won_reason: z.string().max(500).nullable().optional(),
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
  .inputValidator((d) =>
    z.object({
      name: z.string().trim().min(1).max(60),
      color: z.string().max(20).default("slate"),
      is_won: z.boolean().default(false),
      is_lost: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const stages = await ensureStages(db, context.userId);
    const maxPos = Math.max(...stages.map((s) => s.position), -1);
    const { data: newStage, error } = await db.from("crm_stages").insert({
      user_id: context.userId,
      name: data.name,
      color: data.color,
      position: maxPos + 1,
      is_won: data.is_won,
      is_lost: data.is_lost,
    }).select().single();
    if (error) throw new Error(error.message);
    return { ok: true, stage: newStage };
  });

export const renameStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().trim().min(1).max(60).optional(),
      color: z.string().max(20).optional(),
      position: z.number().int().optional(),
      is_won: z.boolean().optional(),
      is_lost: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const patch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
    const { error } = await context.supabase.from("crm_stages").update(patch).eq("id", id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderStages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ stage_ids: z.array(z.string().uuid()) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    for (let i = 0; i < data.stage_ids.length; i++) {
      await db.from("crm_stages").update({ position: i }).eq("id", data.stage_ids[i]!).eq("user_id", context.userId);
    }
    return { ok: true };
  });

export const deleteStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      migrate_to_stage_id: z.string().uuid().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { count } = await db.from("crm_deals").select("id", { count: "exact", head: true }).eq("stage_id", data.id);
    if ((count ?? 0) > 0) {
      if (data.migrate_to_stage_id) {
        const { error: moveErr } = await db.from("crm_deals").update({ stage_id: data.migrate_to_stage_id }).eq("stage_id", data.id).eq("user_id", context.userId);
        if (moveErr) throw new Error(moveErr.message);
      } else {
        throw new Error("This stage has deals in it. Choose a stage to migrate them to or delete them first.");
      }
    }
    const { error } = await db.from("crm_stages").delete().eq("id", data.id).eq("user_id", context.userId);
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
    const [deals, notes, logs, replies, tasks, activities, quotes] = await Promise.all([
      db.from("crm_deals").select("*").eq("contact_id", data.contact_id).order("updated_at", { ascending: false }),
      db.from("crm_notes").select("*").eq("contact_id", data.contact_id).order("created_at", { ascending: false }).limit(200),
      db.from("email_logs").select("id, status, scheduled_at, sent_at, opened_at, replied_at, bounced_at, direct_subject, campaigns(name)").eq("contact_id", data.contact_id).order("scheduled_at", { ascending: false }).limit(100),
      db.from("inbox_messages").select("id, subject, snippet, received_at, is_auto_reply").eq("contact_id", data.contact_id).order("received_at", { ascending: false }).limit(50),
      db.from("linkedin_tasks").select("id, action, status, due_at, completed_at, linkedin_sequences(name)").eq("contact_id", data.contact_id).order("due_at", { ascending: false }).limit(50),
      db.from("crm_activities").select("*").eq("contact_id", data.contact_id).order("schedule_from", { ascending: false }).limit(50),
      db.from("crm_quotes").select("id, title, status, valid_until, currency, created_at").eq("contact_id", data.contact_id).order("created_at", { ascending: false }).limit(20),
    ]);
    return {
      contact,
      stages,
      deals: deals.data ?? [],
      notes: notes.data ?? [],
      logs: logs.data ?? [],
      replies: replies.data ?? [],
      tasks: tasks.data ?? [],
      activities: activities.data ?? [],
      quotes: quotes.data ?? [],
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

function isTableMissingError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "PGRST205" || error.code === "42P01" || (typeof error.message === "string" && error.message.includes("schema cache"));
}

function migrationRequiredError(): Error {
  return new Error("CRM tables have not been created in Supabase yet. Please run the SQL migration in supabase/migrations/20261111000000_crm_krayin_schema.sql in your Supabase dashboard SQL editor.");
}

// ---------- Activities ----------

export const getActivities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ done: z.boolean().optional(), type: z.string().optional(), contact_id: z.string().uuid().optional(), deal_id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    let q = db.from("crm_activities")
      .select("*, contacts(id, email, first_name, last_name, company), crm_deals(id, title)")
      .eq("user_id", context.userId)
      .order("schedule_from", { ascending: true });
    if (data.done !== undefined) q = q.eq("done", data.done);
    if (data.type) q = q.eq("type", data.type);
    if (data.contact_id) q = q.eq("contact_id", data.contact_id);
    if (data.deal_id) q = q.eq("deal_id", data.deal_id);
    const { data: rows, error } = await q.limit(200);
    if (error) {
      if (isTableMissingError(error)) return [];
      throw new Error(error.message);
    }
    return rows ?? [];
  });

export const createActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      type: z.enum(["call", "meeting", "lunch", "task", "email"]).default("call"),
      title: z.string().trim().min(1).max(300),
      description: z.string().max(5000).nullable().default(null),
      location: z.string().max(500).nullable().default(null),
      schedule_from: z.string().nullable().default(null),
      schedule_to: z.string().nullable().default(null),
      contact_id: z.string().uuid().nullable().default(null),
      deal_id: z.string().uuid().nullable().default(null),
      lead_id: z.string().uuid().nullable().default(null),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("crm_activities").insert({ ...data, user_id: context.userId });
    if (error) {
      if (isTableMissingError(error)) throw migrationRequiredError();
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const updateActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      type: z.enum(["call", "meeting", "lunch", "task", "email"]).optional(),
      title: z.string().trim().min(1).max(300).optional(),
      description: z.string().max(5000).nullable().optional(),
      location: z.string().max(500).nullable().optional(),
      schedule_from: z.string().nullable().optional(),
      schedule_to: z.string().nullable().optional(),
      done: z.boolean().optional(),
      contact_id: z.string().uuid().nullable().optional(),
      deal_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const patch = { ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)), updated_at: new Date().toISOString() };
    const { error } = await context.supabase.from("crm_activities").update(patch).eq("id", id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("crm_activities").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Organizations ----------

export const getOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ q: z.string().max(200).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    let q = db.from("crm_organizations").select("*").eq("user_id", context.userId).order("name");
    if (data.q) q = q.ilike("name", `%${data.q}%`);
    const { data: rows, error } = await q.limit(100);
    if (error) {
      if (isTableMissingError(error)) return [];
      throw new Error(error.message);
    }
    return rows ?? [];
  });

export const getOrganization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: org, error } = await db.from("crm_organizations").select("*").eq("id", data.id).eq("user_id", context.userId).single();
    if (error || !org) throw new Error("Organization not found");
    const { data: contacts } = await db.from("contacts").select("id, email, first_name, last_name, company, title").eq("organization_id", data.id).limit(50);
    return { org, contacts: contacts ?? [] };
  });

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      name: z.string().trim().min(1).max(300),
      website: z.string().max(500).nullable().default(null),
      phone: z.string().max(50).nullable().default(null),
      address: z.string().max(500).nullable().default(null),
      city: z.string().max(100).nullable().default(null),
      country: z.string().max(100).nullable().default(null),
      industry: z.string().max(100).nullable().default(null),
      description: z.string().max(5000).nullable().default(null),
      employee_count: z.number().int().min(0).nullable().default(null),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("crm_organizations").insert({ ...data, user_id: context.userId }).select("id").single();
    if (error) {
      if (isTableMissingError(error)) throw migrationRequiredError();
      throw new Error(error.message);
    }
    return { id: row!.id };
  });

export const updateOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().trim().min(1).max(300).optional(),
      website: z.string().max(500).nullable().optional(),
      phone: z.string().max(50).nullable().optional(),
      address: z.string().max(500).nullable().optional(),
      city: z.string().max(100).nullable().optional(),
      country: z.string().max(100).nullable().optional(),
      industry: z.string().max(100).nullable().optional(),
      description: z.string().max(5000).nullable().optional(),
      employee_count: z.number().int().min(0).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const patch = { ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)), updated_at: new Date().toISOString() };
    const { error } = await context.supabase.from("crm_organizations").update(patch).eq("id", id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("crm_organizations").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Products ----------

export const getProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ q: z.string().max(200).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    let q = db.from("crm_products").select("*").eq("user_id", context.userId).order("name");
    if (data.q) q = q.or(`name.ilike.%${data.q}%,sku.ilike.%${data.q}%`);
    const { data: rows, error } = await q.limit(200);
    if (error) {
      if (isTableMissingError(error)) return [];
      throw new Error(error.message);
    }
    return rows ?? [];
  });

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      name: z.string().trim().min(1).max(300),
      sku: z.string().max(100).nullable().default(null),
      description: z.string().max(5000).nullable().default(null),
      price: z.number().min(0).default(0),
      currency: z.string().max(8).default("USD"),
      type: z.enum(["product", "service"]).default("product"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("crm_products").insert({ ...data, user_id: context.userId }).select("id").single();
    if (error) {
      if (isTableMissingError(error)) throw migrationRequiredError();
      throw new Error(error.message);
    }
    return { id: row!.id };
  });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().trim().min(1).max(300).optional(),
      sku: z.string().max(100).nullable().optional(),
      description: z.string().max(5000).nullable().optional(),
      price: z.number().min(0).optional(),
      currency: z.string().max(8).optional(),
      type: z.enum(["product", "service"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const patch = { ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)), updated_at: new Date().toISOString() };
    const { error } = await context.supabase.from("crm_products").update(patch).eq("id", id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("crm_products").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Deal Products ----------

export const getDealProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ deal_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("crm_deal_products")
      .select("*, crm_products(name, sku, price, currency, type)")
      .eq("deal_id", data.deal_id)
      .order("created_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addDealProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      deal_id: z.string().uuid(),
      product_id: z.string().uuid().nullable().default(null),
      name: z.string().trim().min(1).max(300),
      qty: z.number().min(0).default(1),
      unit_price: z.number().min(0).default(0),
      discount_pct: z.number().min(0).max(100).default(0),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: deal } = await context.supabase.from("crm_deals").select("id").eq("id", data.deal_id).eq("user_id", context.userId).single();
    if (!deal) throw new Error("Deal not found");
    const { error } = await context.supabase.from("crm_deal_products").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeDealProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("crm_deal_products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Quotes ----------

export const getQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ status: z.string().optional(), contact_id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("crm_quotes")
      .select("*, contacts(id, email, first_name, last_name, company), crm_deals(id, title)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    if (data.contact_id) q = q.eq("contact_id", data.contact_id);
    const { data: rows, error } = await q.limit(100);
    if (error) {
      if (isTableMissingError(error)) return [];
      throw new Error(error.message);
    }
    return rows ?? [];
  });

export const getQuote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: quote, error } = await db
      .from("crm_quotes")
      .select("*, contacts(id, email, first_name, last_name, company), crm_deals(id, title)")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (error || !quote) throw new Error("Quote not found");
    const { data: items } = await db
      .from("crm_quote_items")
      .select("*, crm_products(name, sku)")
      .eq("quote_id", data.id)
      .order("position");
    return { quote, items: items ?? [] };
  });

export const createQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      title: z.string().trim().min(1).max(300),
      contact_id: z.string().uuid().nullable().default(null),
      deal_id: z.string().uuid().nullable().default(null),
      status: z.enum(["draft", "sent", "accepted", "rejected"]).default("draft"),
      valid_until: z.string().nullable().default(null),
      notes: z.string().max(5000).nullable().default(null),
      currency: z.string().max(8).default("USD"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("crm_quotes").insert({ ...data, user_id: context.userId }).select("id").single();
    if (error) {
      if (isTableMissingError(error)) throw migrationRequiredError();
      throw new Error(error.message);
    }
    return { id: row!.id };
  });

export const updateQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().trim().min(1).max(300).optional(),
      status: z.enum(["draft", "sent", "accepted", "rejected"]).optional(),
      valid_until: z.string().nullable().optional(),
      notes: z.string().max(5000).nullable().optional(),
      currency: z.string().max(8).optional(),
      contact_id: z.string().uuid().nullable().optional(),
      deal_id: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const patch = { ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)), updated_at: new Date().toISOString() };
    const { error } = await context.supabase.from("crm_quotes").update(patch).eq("id", id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("crm_quotes").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Quote Items ----------

export const addQuoteItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      quote_id: z.string().uuid(),
      product_id: z.string().uuid().nullable().default(null),
      name: z.string().trim().min(1).max(300),
      description: z.string().max(2000).nullable().default(null),
      qty: z.number().min(0).default(1),
      unit_price: z.number().min(0).default(0),
      discount_pct: z.number().min(0).max(100).default(0),
      position: z.number().int().default(0),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: quote } = await context.supabase.from("crm_quotes").select("id").eq("id", data.quote_id).eq("user_id", context.userId).single();
    if (!quote) throw new Error("Quote not found");
    const { error } = await context.supabase.from("crm_quote_items").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateQuoteItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().trim().min(1).max(300).optional(),
      description: z.string().max(2000).nullable().optional(),
      qty: z.number().min(0).optional(),
      unit_price: z.number().min(0).optional(),
      discount_pct: z.number().min(0).max(100).optional(),
      position: z.number().int().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const patch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
    const { error } = await context.supabase.from("crm_quote_items").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteQuoteItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("crm_quote_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Leads ----------

export const getLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ status: z.string().optional(), q: z.string().max(200).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const stages = await ensureStages(db, context.userId);
    let q = db.from("crm_leads")
      .select("*, crm_stages(id, name, color), contacts(id, email, first_name, last_name)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    if (data.q) {
      q = q.or(`title.ilike.%${data.q}%,email.ilike.%${data.q}%,first_name.ilike.%${data.q}%,last_name.ilike.%${data.q}%,company.ilike.%${data.q}%`);
    }
    const { data: rows, error } = await q.limit(200);
    if (error) {
      if (isTableMissingError(error)) return { leads: [], stages };
      throw new Error(error.message);
    }
    return { leads: rows ?? [], stages };
  });

export const getLead = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const stages = await ensureStages(db, context.userId);
    const { data: lead, error } = await db
      .from("crm_leads")
      .select("*, crm_stages(id, name, color), contacts(id, email, first_name, last_name, company), crm_deals(id, title, value, currency)")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (error || !lead) throw new Error("Lead not found");
    const { data: activities } = await db.from("crm_activities").select("*").eq("lead_id", data.id).order("schedule_from", { ascending: false }).limit(50);
    return { lead, stages, activities: activities ?? [] };
  });

export const createLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      title: z.string().trim().min(1).max(300),
      description: z.string().max(5000).nullable().default(null),
      source: z.string().max(100).nullable().default(null),
      type: z.string().max(100).nullable().default(null),
      lead_value: z.number().min(0).default(0),
      currency: z.string().max(8).default("USD"),
      expected_close: z.string().nullable().default(null),
      first_name: z.string().max(100).nullable().default(null),
      last_name: z.string().max(100).nullable().default(null),
      email: z.string().email().nullable().default(null),
      phone: z.string().max(50).nullable().default(null),
      company: z.string().max(300).nullable().default(null),
      stage_id: z.string().uuid().nullable().default(null),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    let stageId = data.stage_id;
    if (!stageId) {
      const stages = await ensureStages(db, context.userId);
      stageId = stages.find((s) => !s.is_won && !s.is_lost)?.id ?? stages[0]!.id;
    }
    const { data: row, error } = await db.from("crm_leads").insert({ ...data, stage_id: stageId, user_id: context.userId }).select("id").single();
    if (error) {
      if (isTableMissingError(error)) throw migrationRequiredError();
      throw new Error(error.message);
    }
    return { id: row!.id };
  });

export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().trim().min(1).max(300).optional(),
      description: z.string().max(5000).nullable().optional(),
      source: z.string().max(100).nullable().optional(),
      type: z.string().max(100).nullable().optional(),
      status: z.enum(["new", "in_progress", "converted", "lost"]).optional(),
      lead_value: z.number().min(0).optional(),
      currency: z.string().max(8).optional(),
      expected_close: z.string().nullable().optional(),
      first_name: z.string().max(100).nullable().optional(),
      last_name: z.string().max(100).nullable().optional(),
      email: z.string().email().nullable().optional(),
      phone: z.string().max(50).nullable().optional(),
      company: z.string().max(300).nullable().optional(),
      stage_id: z.string().uuid().nullable().optional(),
      lost_reason: z.string().max(500).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const patch = { ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)), updated_at: new Date().toISOString() };
    const { error } = await context.supabase.from("crm_leads").update(patch).eq("id", id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("crm_leads").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const convertLeadToDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      lead_id: z.string().uuid(),
      contact_id: z.string().uuid(),
      stage_id: z.string().uuid().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: lead, error: leadErr } = await db.from("crm_leads").select("*").eq("id", data.lead_id).eq("user_id", context.userId).single();
    if (leadErr || !lead) throw new Error("Lead not found");
    const stages = await ensureStages(db, context.userId);
    const stageId = data.stage_id ?? stages.find((s) => !s.is_won && !s.is_lost)?.id ?? stages[0]!.id;
    const { data: deal, error: dealErr } = await db.from("crm_deals").insert({
      user_id: context.userId,
      contact_id: data.contact_id,
      stage_id: stageId,
      title: lead.title,
      value: lead.lead_value,
      currency: lead.currency,
      expected_close: lead.expected_close,
    }).select("id").single();
    if (dealErr || !deal) throw new Error(dealErr?.message ?? "Could not create deal");
    await db.from("crm_leads").update({ status: "converted", contact_id: data.contact_id, deal_id: deal.id, updated_at: new Date().toISOString() }).eq("id", data.lead_id);
    return { deal_id: deal.id };
  });

// ---------- CRM Dashboard ----------

export const getCrmDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const stages = await ensureStages(db, context.userId);
    const wonStageIds = stages.filter((s) => s.is_won).map((s) => s.id);
    const lostStageIds = stages.filter((s) => s.is_lost).map((s) => s.id);

    const [dealsRes, activitiesRes, leadsRes, quotesRes] = await Promise.all([
      db.from("crm_deals").select("id, stage_id, value, currency, created_at, updated_at, contacts(first_name, last_name, email, company)").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(500),
      db.from("crm_activities").select("id, type, title, done, schedule_from, contact_id, contacts(first_name, last_name, email)").eq("user_id", context.userId).eq("done", false).gte("schedule_from", new Date().toISOString()).order("schedule_from").limit(10),
      db.from("crm_leads").select("id, title, status, lead_value, currency, created_at").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(10),
      db.from("crm_quotes").select("id, title, status, created_at").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(5),
    ]);

    const deals = dealsRes.data ?? [];
    const openDeals = deals.filter((d) => !wonStageIds.includes(d.stage_id) && !lostStageIds.includes(d.stage_id));
    const wonDeals = deals.filter((d) => wonStageIds.includes(d.stage_id));
    const lostDeals = deals.filter((d) => lostStageIds.includes(d.stage_id));
    const totalPipelineValue = openDeals.reduce((s, d) => s + Number(d.value), 0);
    const wonValue = wonDeals.reduce((s, d) => s + Number(d.value), 0);
    const winRate = wonDeals.length + lostDeals.length > 0
      ? Math.round(wonDeals.length / (wonDeals.length + lostDeals.length) * 100)
      : 0;

    const dealsByStage = stages.map((s) => ({
      stage: s.name,
      color: s.color,
      count: deals.filter((d) => d.stage_id === s.id).length,
      value: deals.filter((d) => d.stage_id === s.id).reduce((sum, d) => sum + Number(d.value), 0),
    }));

    const now = new Date();
    const monthlyRevenue: { month: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      const value = wonDeals
        .filter((deal) => {
          const at = new Date(deal.updated_at);
          return at.getFullYear() === d.getFullYear() && at.getMonth() === d.getMonth();
        })
        .reduce((s, deal) => s + Number(deal.value), 0);
      monthlyRevenue.push({ month: label, value });
    }

    return {
      totalPipelineValue,
      wonValue,
      winRate,
      openCount: openDeals.length,
      wonCount: wonDeals.length,
      lostCount: lostDeals.length,
      totalLeads: (leadsRes.data ?? []).filter((l) => l.status === "new" || l.status === "in_progress").length,
      dealsByStage,
      monthlyRevenue,
      upcomingActivities: activitiesRes.data ?? [],
      recentDeals: deals.slice(0, 5),
      recentLeads: leadsRes.data ?? [],
      pendingQuotes: (quotesRes.data ?? []).filter((q) => q.status === "draft" || q.status === "sent").length,
      currency: deals[0]?.currency ?? "USD",
    };
  });
