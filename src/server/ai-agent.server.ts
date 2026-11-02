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
import { chat, getLlmConfig, personalizeLead, webSearch, type ChatMsg, type ToolSpec, type Lead, type SearchConfig } from "@/server/llm.server";

type AnyTool = { name: string; description: string; inputSchema?: Record<string, z.ZodType>; handler: (args: never, ctx: ToolContext) => unknown };

const MCP_TOOLS = [
  listContactLists, listContacts, updateContactFields, createContactList, addContacts, deleteContacts,
  listTemplates, saveTemplate, listCampaigns, getCampaignStats, listInbox, listOutbox, manageSuppressions,
  getContactDetail, updateContactProfile,
  listLinkedinSequences, setLinkedinSequenceStatus, listLinkedinTasks, completeLinkedinTask, markLinkedinReplied, getLinkedinActivity,
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

export async function personalizeWithDb(db: Db, userId: string, ids: string[], instructions: string) {
  const cfg = await getLlmConfig(userId);
  const { data, error } = await db.from("contacts").select("id, email, first_name, last_name, company, title, linkedin_url, custom_fields").in("id", ids);
  if (error) throw new Error(error.message);
  const results: { id: string; email: string; ok: boolean; opener?: string; error?: string }[] = [];
  for (const c of data ?? []) {
    try {
      const fields = asFields(c.custom_fields);
      const lead: Lead = { email: c.email, first_name: c.first_name ?? "", last_name: c.last_name ?? "", company: c.company ?? "", title: c.title ?? "", linkedin_url: c.linkedin_url ?? "", custom_fields: fields };
      const out = await personalizeLead(userId, cfg, lead, instructions);
      const next = { ...fields, ai_opener: out.opener, ai_subject: out.subject, ai_body: out.body };
      const { error: upErr } = await db.from("contacts").update({ custom_fields: next }).eq("id", c.id);
      if (upErr) throw new Error(upErr.message);
      results.push({ id: c.id, email: c.email, ok: true, opener: out.opener });
    } catch (e) {
      results.push({ id: c.id, email: c.email, ok: false, error: e instanceof Error ? e.message : "Failed" });
    }
  }
  return { results };
}

const SYSTEM = `You are the AceMail assistant inside the user's AceMail app (cold email + LinkedIn outreach).
You can act on the user's account with tools: contact lists, contacts and custom fields, templates, campaigns and stats, inbox, outbox, do-not-contact list, LinkedIn sequences and tasks.
Use personalize_contacts to research leads (company website and web search) and write a personalised opener, subject and body per lead; they are saved as {{ai_opener}}, {{ai_subject}} and {{ai_body}} fields usable in templates.
Use web_search for any general research. Do the work instead of describing it. Look up IDs with list tools before acting. Be concise, use plain language, no em dashes.
Connecting mailboxes, connecting LinkedIn and pressing Start on an email campaign happen on their pages in the app; tell the user where to click when needed.`;

export async function runAgent(db: Db, userId: string, token: string, history: { role: "user" | "assistant"; content: string }[]) {
  const cfg = await getLlmConfig(userId);
  const ctx = { getToken: () => token } as unknown as ToolContext;
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
      description: "Search the web. Requires the user to have added a Tavily or Exa key in Settings.",
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
          const { data } = await (await import("@/integrations/supabase/client.server")).supabaseAdmin
            .from("user_api_keys").select("key_ciphertext").eq("user_id", userId).eq("provider", "search").maybeSingle();
          if (!data) throw new Error("No web search key. Ask the user to add a Tavily or Exa key in Settings.");
          const { decryptConnectionKey } = await import("@/server/connectionKeyCrypto");
          const sc = JSON.parse(decryptConnectionKey(data.key_ciphertext)) as SearchConfig;
          result = (await webSearch(sc, String(call.args["query"] ?? ""))) || "No results.";
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
