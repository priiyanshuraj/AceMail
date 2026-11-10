// Server-only in-app AI assistant. Reuses the MCP tool catalog so the assistant can do
// everything ChatGPT/Claude can do over MCP, querying as the signed-in user (RLS applies).
import { z } from "zod";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import listContactLists from "@/lib/mcp/tools/list-contact-lists";
import listContacts from "@/lib/mcp/tools/list-contacts";
import updateContactFields from "@/lib/mcp/tools/update-contact-fields";
import createContactList from "@/lib/mcp/tools/create-contact-list";
import addContacts from "@/lib/mcp/tools/add-contacts";
import deleteContacts from "@/lib/mcp/tools/delete-contacts";
import listTemplates from "@/lib/mcp/tools/list-templates";
import saveTemplate from "@/lib/mcp/tools/save-template";
import listCampaigns from "@/lib/mcp/tools/list-campaigns";
import getCampaignStats from "@/lib/mcp/tools/get-campaign-stats";
import listInbox from "@/lib/mcp/tools/list-inbox";
import listOutbox from "@/lib/mcp/tools/list-outbox";
import manageSuppressions from "@/lib/mcp/tools/manage-suppressions";
import {
  listLinkedinSequences, setLinkedinSequenceStatus, listLinkedinTasks, completeLinkedinTask,
  markLinkedinReplied, getLinkedinActivity, getContactDetail, updateContactProfile,
} from "@/lib/mcp/tools/linkedin";
import { listCrmStages, manageCrmStages } from "@/lib/mcp/tools/crm-stages";
import { listCrmDeals, manageCrmDeals } from "@/lib/mcp/tools/crm-deals";
import { listCrmLeads, manageCrmLeads } from "@/lib/mcp/tools/crm-leads";
import { listCrmActivities, manageCrmActivities } from "@/lib/mcp/tools/crm-activities";
import { listCrmOrganizations, manageCrmOrganizations } from "@/lib/mcp/tools/crm-organizations";
import { listCrmProducts, manageCrmProducts, listCrmQuotes, manageCrmQuotes } from "@/lib/mcp/tools/crm-products-quotes";
import { chat, getLlmConfig, personalizeLead, webSearch, internalSiftdogSearch, type ChatMsg, type ToolSpec, type Lead, type SearchConfig } from "@/server/llm.server";

type AnyTool = { name: string; description: string; inputSchema?: Record<string, z.ZodType>; handler: (args: never, ctx: ToolContext) => unknown };

const MCP_TOOLS = [
  listContactLists, listContacts, updateContactFields, createContactList, addContacts, deleteContacts,
  listTemplates, saveTemplate, listCampaigns, getCampaignStats, listInbox, listOutbox, manageSuppressions,
  getContactDetail, updateContactProfile,
  listLinkedinSequences, setLinkedinSequenceStatus, listLinkedinTasks, completeLinkedinTask, markLinkedinReplied, getLinkedinActivity,
  listCrmStages, manageCrmStages,
  listCrmDeals, manageCrmDeals,
  listCrmLeads, manageCrmLeads,
  listCrmActivities, manageCrmActivities,
  listCrmOrganizations, manageCrmOrganizations,
  listCrmProducts, manageCrmProducts,
  listCrmQuotes, manageCrmQuotes,
] as unknown as AnyTool[];

function toSpec(t: AnyTool): ToolSpec {
  const schema = z.toJSONSchema(z.object(t.inputSchema ?? {})) as Record<string, unknown>;
  delete schema["$schema"];
  return { name: t.name, description: t.description, parameters: schema };
}

type Db = SupabaseClient;

function asFields(v: unknown): Record<string, string> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, x == null ? "" : String(x)])) : {};
}

export async function personalizeWithDb(db: Db, userId: string, ids: string[], instructions: string, kind: "email" | "linkedin" = "email") {
  const { generationModel, consumeCredit } = await import("@/server/ai-quota.server");
  const { personalizeLinkedin } = await import("@/server/llm.server");
  const { cfg, hosted } = await generationModel(userId);
  const { data, error } = await db.from("contacts").select("id, email, first_name, last_name, company, title, linkedin_url, custom_fields").in("id", ids);
  if (error) throw new Error(error.message);
  const results: { id: string; email: string; ok: boolean; opener?: string; error?: string }[] = [];
  for (const c of data ?? []) {
    try {
      const fields = asFields(c.custom_fields);
      const lead: Lead = { email: c.email, first_name: c.first_name ?? "", last_name: c.last_name ?? "", company: c.company ?? "", title: c.title ?? "", linkedin_url: c.linkedin_url ?? "", custom_fields: fields };
      if (hosted) await consumeCredit(userId, kind);
      let next: Record<string, string>;
      let preview: string;
      if (kind === "linkedin") {
        const out = await personalizeLinkedin(userId, cfg, lead, instructions);
        next = { ...fields, ai_linkedin: out.message };
        preview = out.message;
      } else {
        const out = await personalizeLead(userId, cfg, lead, instructions);
        next = { ...fields, ai_opener: out.opener, ai_subject: out.subject, ai_body: out.body };
        preview = out.opener;
      }
      const { error: upErr } = await db.from("contacts").update({ custom_fields: next }).eq("id", c.id);
      if (upErr) throw new Error(upErr.message);
      results.push({ id: c.id, email: c.email, ok: true, opener: preview });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      results.push({ id: c.id, email: c.email, ok: false, error: msg });
      if (msg.includes("today's free AI") || msg.includes("turned off")) break;
    }
  }
  return { results };
}

const SYSTEM = `You are the AceMail AI assistant inside the user's AceMail app (cold email outreach + full CRM suite).
You can act on the user's account with full tool access:
- CRM Sales Pipeline: list stages, add new stages, rename stages, recolor stages, reorder stages, and delete stages (with deal migration).
- CRM Deals: list deals, create deals, update values, move deals between stages, track won/lost reasons, and delete deals.
- CRM Leads: list inbound/outbound leads, create leads, update lead status, and convert leads to active pipeline deals.
- CRM Activities: list scheduled activities, schedule calls/meetings/lunches/tasks, mark activities done, or delete activities.
- CRM Organizations: list, create, update, and manage company accounts.
- CRM Products & Quotes: manage product catalog, draft and update itemized quotes, and manage quote line items.
- Outreach: contact lists, contacts, custom template variables, email templates, campaigns and stats, inbox replies, outbox logs, suppressions, LinkedIn sequences and tasks.
- Personalization: use personalize_contacts to research leads (company website and web search) and write a personalised opener, subject and body per lead; they are saved as {{ai_opener}}, {{ai_subject}} and {{ai_body}} fields usable in templates.
- Web search: use web_search for any general research.

Do the work directly instead of just describing it. Look up IDs with list tools before modifying them. Be concise, use plain language, no em dashes.`;

export async function runAgent(db: Db, userId: string, token: string, history: { role: "user" | "assistant"; content: string }[]) {
  const cfg = await getLlmConfig(userId);
  const ctx = { getToken: () => token, getUserId: () => userId } as unknown as ToolContext;
  const byName = new Map(MCP_TOOLS.map((t) => [t.name, t]));
  const tools: ToolSpec[] = [
    ...MCP_TOOLS.map(toSpec),
    {
      name: "personalize_contacts",
      description: "Research up to 10 contacts and write a personalised opener, subject and email body for each. Saves them on the contact as ai_opener, ai_subject, ai_body.",
      parameters: { type: "object", properties: { contact_ids: { type: "array", items: { type: "string" }, maxItems: 10 }, instructions: { type: "string", description: "What the sender offers and the tone." } }, required: ["contact_ids"] },
    },
    {
      name: "web_search",
      description: "Search the web using AceMail's built-in Siftdog search engine, or configured search provider.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  ];

  const messages: ChatMsg[] = [{ role: "system", content: SYSTEM }, ...history];
  const actions: { tool: string; ok: boolean }[] = [];
  for (let step = 0; step < 10; step++) {
    const r = await chat(cfg, messages, tools);
    if (!r.toolCalls.length) return { reply: r.text || "Done.", actions };
    messages.push({ role: "assistant", content: r.text, toolCalls: r.toolCalls });
    for (const call of r.toolCalls) {
      let result: string;
      let ok = true;
      try {
        if (call.name === "personalize_contacts") {
          const ids = z.array(z.string().uuid()).min(1).max(10).parse(call.args["contact_ids"]);
          result = JSON.stringify(await personalizeWithDb(db, userId, ids, String(call.args["instructions"] ?? "")));
        } else if (call.name === "web_search") {
          const q = String(call.args["query"] ?? "");
          const { data } = await (await import("@/integrations/supabase/client.server")).supabaseAdmin
            .from("user_api_keys").select("key_ciphertext").eq("user_id", userId).eq("provider", "search").maybeSingle();
          if (data) {
            const { decryptConnectionKey } = await import("@/server/connection-crypto.server");
            const sc = JSON.parse(decryptConnectionKey(data.key_ciphertext)) as SearchConfig;
            result = (await webSearch(sc, q)) || "No results.";
          } else {
            const internal = await internalSiftdogSearch(q);
            result = internal || "No search results found.";
          }
        } else {
          const tool = byName.get(call.name);
          if (!tool) throw new Error(`Unknown tool ${call.name}`);
          const args = z.object(tool.inputSchema ?? {}).parse(call.args);
          const out = (await tool.handler(args as never, ctx)) as { content?: { type: string; text?: string }[] };
          result = (out.content ?? []).map((c) => c.text ?? "").join("\n").slice(0, 12000);
        }
      } catch (e) {
        ok = false;
        result = `Error: ${e instanceof Error ? e.message : "failed"}`;
      }
      actions.push({ tool: call.name, ok });
      messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: result });
    }
  }
  return { reply: "I stopped after 10 steps. Tell me to continue if you want me to keep going.", actions };
}
