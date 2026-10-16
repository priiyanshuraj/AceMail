// Server-only LinkedIn sequence helpers shared by the app and the runner API.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { renderEmailVariables } from "@/lib/email-content";
import { spin } from "@/lib/deliverability";

export type LinkedinAction = "visit" | "connect" | "message" | "follow" | "endorse";
export type LinkedinStep = { action: LinkedinAction; delay_days: number; message?: string };
type Db = SupabaseClient<Database>;

export function contactLinkedinUrl(c: { linkedin_url?: string | null; custom_fields?: unknown }) {
  if (c.linkedin_url) return c.linkedin_url;
  const cf = (c.custom_fields ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(cf)) {
    if (/linked\s*in/i.test(k) && typeof v === "string" && /linkedin\.com\//i.test(v)) return v.trim();
  }
  return "";
}

export function personalize(text: string, c: Record<string, unknown>) {
  const values = { ...((c["custom_fields"] as Record<string, unknown>) ?? {}), ...c };
  return renderEmailVariables(spin(text), values).trim();
}

/** Queue the first step for every contact in the list that has a LinkedIn profile. */
export async function seedSequence(db: Db, seq: { id: string; user_id: string; list_id: string; steps: LinkedinStep[] }) {
  const first = seq.steps[0];
  if (!first) return 0;
  let added = 0;
  for (let from = 0; ; from += 1000) {
    const { data: contacts } = await db.from("contacts").select("*").eq("list_id", seq.list_id).order("id").range(from, from + 999);
    const rows = (contacts ?? [])
      .filter((c) => !c.unsubscribed && contactLinkedinUrl(c))
      .map((c) => ({
        user_id: seq.user_id, sequence_id: seq.id, contact_id: c.id, step_index: 0,
        action: first.action, message: personalize(first.message ?? "", c), due_at: new Date().toISOString(),
      }));
    if (rows.length) {
      const { error } = await db.from("linkedin_tasks").upsert(rows, { onConflict: "sequence_id,contact_id,step_index", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
      added += rows.length;
    }
    if (!contacts || contacts.length < 1000) break;
  }
  return added;
}

/** Mark a task finished and schedule the contact's next step. */
export async function finishTask(db: Db, taskId: string, status: "done" | "skipped" | "failed", note?: string) {
  const { data: task } = await db.from("linkedin_tasks").select("*, linkedin_sequences(steps, status)").eq("id", taskId).maybeSingle();
  if (!task) throw new Error("Task not found");
  await db.from("linkedin_tasks").update({ status, note: note?.slice(0, 500) ?? null, completed_at: new Date().toISOString() }).eq("id", taskId);
  const seq = task.linkedin_sequences as unknown as { steps: LinkedinStep[]; status: string } | null;
  if (status !== "done" || !seq) return;
  const next = seq.steps[task.step_index + 1];
  if (!next) return;
  const { data: c } = await db.from("contacts").select("*").eq("id", task.contact_id).maybeSingle();
  if (!c) return;
  await db.from("linkedin_tasks").upsert({
    user_id: task.user_id, sequence_id: task.sequence_id, contact_id: task.contact_id, step_index: task.step_index + 1,
    action: next.action, message: personalize(next.message ?? "", c),
    due_at: new Date(Date.now() + next.delay_days * 86400_000).toISOString(),
  }, { onConflict: "sequence_id,contact_id,step_index", ignoreDuplicates: true });
}

/** Due tasks for today, capped by each sequence's daily connect/message limits. */
export async function dueTasks(db: Db, userId: string, mode: "assisted" | "runner", max = 100) {
  const { data: seqs } = await db.from("linkedin_sequences").select("id, name, daily_connect_limit, daily_message_limit")
    .eq("user_id", userId).eq("status", "running").eq("mode", mode);
  if (!seqs?.length) return [];
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const out = [];
  for (const s of seqs) {
    const { data: doneToday } = await db.from("linkedin_tasks").select("action").eq("sequence_id", s.id).eq("status", "done").gte("completed_at", dayStart.toISOString());
    let connects = s.daily_connect_limit - (doneToday ?? []).filter((t) => t.action === "connect").length;
    let messages = s.daily_message_limit - (doneToday ?? []).filter((t) => t.action === "message").length;
    const { data: tasks } = await db.from("linkedin_tasks")
      .select("id, action, message, due_at, step_index, contact_id, contacts(first_name, last_name, company, title, email, linkedin_url, custom_fields)")
      .eq("sequence_id", s.id).eq("status", "pending").lte("due_at", new Date().toISOString()).order("due_at").limit(max);
    for (const t of tasks ?? []) {
      if (t.action === "connect" && connects-- <= 0) continue;
      if (t.action === "message" && messages-- <= 0) continue;
      const c = t.contacts as unknown as Record<string, unknown> & { linkedin_url: string };
      out.push({ ...t, sequence_name: s.name, profile_url: contactLinkedinUrl(c) });
    }
  }
  return out.slice(0, max);
}

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
