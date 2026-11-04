// Server-only "bring your own model" client. Users connect DeepSeek, OpenAI, Anthropic
// or any OpenAI-compatible API with their own key; keys are encrypted in user_api_keys.
import { encryptConnectionKey, decryptConnectionKey } from "@/server/connectionKeyCrypto";

export type LlmProvider = "deepseek" | "openai" | "anthropic" | "custom";
export type LlmConfig = { provider: LlmProvider; baseUrl: string; model: string; key: string };
export type SearchProvider = "tavily" | "exa";
export type SearchConfig = { provider: SearchProvider; key: string };

export const PROVIDER_DEFAULTS: Record<LlmProvider, { baseUrl: string; model: string }> = {
  deepseek: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
  anthropic: { baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-5" },
  custom: { baseUrl: "", model: "" },
};

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function saveJson(userId: string, provider: string, value: object, hint: string) {
  const db = await admin();
  const { error } = await db.from("user_api_keys").upsert({
    user_id: userId, provider, key_ciphertext: encryptConnectionKey(JSON.stringify(value)), hint, updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

async function loadJson<T>(userId: string, provider: string): Promise<T | null> {
  const db = await admin();
  const { data } = await db.from("user_api_keys").select("key_ciphertext").eq("user_id", userId).eq("provider", provider).maybeSingle();
  if (!data) return null;
  try { return JSON.parse(decryptConnectionKey(data.key_ciphertext)) as T; } catch { return null; }
}

export async function deleteKey(userId: string, provider: "llm" | "search") {
  const db = await admin();
  await db.from("user_api_keys").delete().eq("user_id", userId).eq("provider", provider);
}

export async function saveLlmConfig(userId: string, cfg: Omit<LlmConfig, "key"> & { key?: string | undefined }) {
  const prev = await loadJson<LlmConfig>(userId, "llm");
  const key = cfg.key?.trim() || prev?.key;
  if (!key) throw new Error("Paste your API key");
  const d = PROVIDER_DEFAULTS[cfg.provider];
  const full: LlmConfig = { provider: cfg.provider, baseUrl: (cfg.baseUrl || d.baseUrl).replace(/\/+$/, ""), model: cfg.model || d.model, key };
  if (!full.baseUrl || !full.model) throw new Error("Add the API address and model name");
  await saveJson(userId, "llm", full, key.slice(-4));
}

export async function saveSearchConfig(userId: string, cfg: SearchConfig) {
  await saveJson(userId, "search", cfg, cfg.key.slice(-4));
}

export async function aiStatus(userId: string) {
  const [llm, search] = await Promise.all([loadJson<LlmConfig>(userId, "llm"), loadJson<SearchConfig>(userId, "search")]);
  return {
    llm: llm ? { provider: llm.provider, baseUrl: llm.baseUrl, model: llm.model, hint: llm.key.slice(-4) } : null,
    search: search ? { provider: search.provider, hint: search.key.slice(-4) } : null,
    internalSearch: true,
  };
}

export async function getLlmConfig(userId: string) {
  const cfg = await loadJson<LlmConfig>(userId, "llm");
  if (!cfg) throw new Error("Connect an AI model in Settings first");
  return cfg;
}

// ---------- Unified chat with tool calling ----------

export type ToolSpec = { name: string; description: string; parameters: Record<string, unknown> };
export type ToolCall = { id: string; name: string; args: Record<string, unknown> };
export type ChatMsg =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; name: string; content: string };

async function failure(res: Response, label: string): Promise<never> {
  const body = await res.text();
  console.error(`${label} failed [${res.status}]: ${body.slice(0, 500)}`);
  if (res.status === 401 || res.status === 403) throw new Error(`${label} rejected your API key. Check it in Settings.`);
  if (res.status === 402) throw new Error(`${label} says your account has no balance left.`);
  if (res.status === 429) throw new Error(`${label} rate limit reached. Try again in a minute.`);
  if (res.status === 404) throw new Error(`${label} could not find that model. Check the model name in Settings.`);
  throw new Error(`${label} request failed (${res.status})`);
}

export async function chat(cfg: LlmConfig, messages: ChatMsg[], tools: ToolSpec[] = []): Promise<{ text: string; toolCalls: ToolCall[] }> {
  return cfg.provider === "anthropic" ? chatAnthropic(cfg, messages, tools) : chatOpenAi(cfg, messages, tools);
}

async function chatOpenAi(cfg: LlmConfig, messages: ChatMsg[], tools: ToolSpec[]) {
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages: messages.map((m) => {
      if (m.role === "tool") return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
      if (m.role === "assistant" && m.toolCalls?.length)
        return { role: "assistant", content: m.content || null, tool_calls: m.toolCalls.map((t) => ({ id: t.id, type: "function", function: { name: t.name, arguments: JSON.stringify(t.args) } })) };
      return { role: m.role, content: m.content };
    }),
  };
  if (tools.length) body["tools"] = tools.map((t) => ({ type: "function", function: t }));
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` }, body: JSON.stringify(body),
  });
  if (!res.ok) await failure(res, "Your AI provider");
  const json = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[] };
  const msg = json.choices?.[0]?.message;
  return {
    text: msg?.content ?? "",
    toolCalls: (msg?.tool_calls ?? []).map((t) => {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(t.function.arguments || "{}"); } catch { /* bad args become {} */ }
      return { id: t.id, name: t.function.name, args };
    }),
  };
}

async function chatAnthropic(cfg: LlmConfig, messages: ChatMsg[], tools: ToolSpec[]) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const out: { role: "user" | "assistant"; content: unknown[] }[] = [];
  const push = (role: "user" | "assistant", block: unknown) => {
    const last = out[out.length - 1];
    if (last && last.role === role) last.content.push(block); else out.push({ role, content: [block] });
  };
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "user") push("user", { type: "text", text: m.content });
    else if (m.role === "tool") push("user", { type: "tool_result", tool_use_id: m.toolCallId, content: m.content });
    else {
      if (m.content) push("assistant", { type: "text", text: m.content });
      for (const t of (m.role === "assistant" ? m.toolCalls : undefined) ?? []) push("assistant", { type: "tool_use", id: t.id, name: t.name, input: t.args });
    }
  }
  const body: Record<string, unknown> = { model: cfg.model, max_tokens: 4096, system, messages: out };
  if (tools.length) body["tools"] = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
  const res = await fetch(`${cfg.baseUrl}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": cfg.key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await failure(res, "Anthropic");
  const json = (await res.json()) as { content?: ({ type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> })[] };
  const blocks = json.content ?? [];
  return {
    text: blocks.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join(""),
    toolCalls: blocks.filter((b) => b.type === "tool_use").map((b) => {
      const t = b as { id: string; name: string; input: Record<string, unknown> };
      return { id: t.id, name: t.name, args: t.input ?? {} };
    }),
  };
}

// ---------- Built-in search engine ----------

/**
 * Returns the URL of an external Siftdog instance if explicitly configured.
 */
export function internalSiftdogUrl(): string | null {
  return (process.env["SIFTDOG_INTERNAL_URL"] ?? "").replace(/\/+$/, "") || null;
}

/**
 * Built-in search engine running directly inside AceMail.
 * Does not require external Docker containers or paid API keys.
 * If SIFTDOG_INTERNAL_URL is reachable, it queries that; otherwise it performs
 * native search via DuckDuckGo HTML API directly in Node.js.
 */
export async function internalSearch(query: string): Promise<string> {
  const customUrl = internalSiftdogUrl();
  if (customUrl) {
    try {
      const res = await fetch(`${customUrl}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, max_results: 5, search_depth: "basic" }),
      });
      if (res.ok) {
        const j = (await res.json()) as { results?: { title: string; url: string; content: string }[] };
        if (j.results?.length) {
          return j.results.map((r) => `- ${r.title} (${r.url}): ${r.content}`).join("\n").slice(0, 4000);
        }
      }
    } catch {
      // Fall through to native search
    }
  }

  // Native internal web search running inside AceMail process
  try {
    const url = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
      },
    });
    clearTimeout(t);
    if (!res.ok) return "";
    const html = await res.text();
    const results: { title: string; url: string; content: string }[] = [];
    const blocks = html.split(/<div[^>]*class="[^"]*result\b[^"]*"[^>]*>/);
    for (const block of blocks.slice(1)) {
      const titleMatch = block.match(/<a[^>]*class="[^"]*result__url[^"]*"[^>]*href="([^"]*)"[^>]*>/)
        || block.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*href="([^"]*)"[^>]*>/);
      const snippetMatch = block.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/);
      const titleTextMatch = block.match(/<h2[^>]*class="[^"]*result__title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/);

      const title = (titleTextMatch?.[1] ?? "").replace(/<[^>]+>/g, "").trim();
      const snippet = (snippetMatch?.[1] ?? "").replace(/<[^>]+>/g, "").trim();
      let rawUrl = titleMatch?.[1] ?? "";
      if (rawUrl && rawUrl.includes("uddg=")) {
        try {
          const u = new URL("https:" + (rawUrl.startsWith("//") ? rawUrl : "//" + rawUrl));
          rawUrl = decodeURIComponent(u.searchParams.get("uddg") || rawUrl);
        } catch { /* keep rawUrl */ }
      }
      if (title && snippet) {
        results.push({ title, url: rawUrl, content: snippet });
      }
      if (results.length >= 5) break;
    }
    return results.map((r) => `- ${r.title} (${r.url}): ${r.content}`).join("\n").slice(0, 4000);
  } catch {
    return "";
  }
}

/** Backwards-compatible alias */
export const internalSiftdogSearch = internalSearch;

// ---------- Lead research ----------

const FREE_MAIL = new Set(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com", "proton.me", "protonmail.com", "live.com", "yandex.com", "zoho.com", "gmx.com", "mail.com"]);

export type Lead = { email: string; first_name: string; last_name: string; company: string; title?: string; linkedin_url?: string; custom_fields: Record<string, string> };

export function leadWebsite(lead: Lead): string | null {
  const cf = lead.custom_fields;
  const raw = Object.entries(cf).find(([k]) => /^(website|company[ _-]?website|url|domain|site)$/i.test(k.trim()))?.[1];
  if (raw && raw.trim()) return raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`;
  const domain = lead.email.split("@")[1]?.toLowerCase();
  if (domain && !FREE_MAIL.has(domain) && !domain.endsWith(".invalid")) return `https://${domain}`;
  return null;
}

function stripHtml(html: string) {
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "";
  const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ?? "";
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&amp;|&#\d+;|&\w+;/g, " ").replace(/\s+/g, " ").trim();
  return `${title}\n${desc}\n${text}`.slice(0, 3000);
}

async function readWebsite(url: string): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; AceMailResearch/1.0)" }, redirect: "follow" });
    clearTimeout(t);
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return "";
    return stripHtml(await res.text());
  } catch { return ""; }
}

export async function webSearch(cfg: SearchConfig, query: string): Promise<string> {
  try {
    if (cfg.provider === "tavily") {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
        body: JSON.stringify({ query, max_results: 5, search_depth: "basic" }),
      });
      if (!res.ok) { console.error("Tavily", res.status, await res.text()); return ""; }
      const j = (await res.json()) as { results?: { title: string; url: string; content: string }[] };
      return (j.results ?? []).map((r) => `- ${r.title} (${r.url}): ${r.content}`).join("\n").slice(0, 4000);
    }
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST", headers: { "Content-Type": "application/json", "x-api-key": cfg.key },
      body: JSON.stringify({ query, numResults: 5, contents: { text: { maxCharacters: 800 } } }),
    });
    if (!res.ok) { console.error("Exa", res.status, await res.text()); return ""; }
    const j = (await res.json()) as { results?: { title: string; url: string; text?: string }[] };
    return (j.results ?? []).map((r) => `- ${r.title} (${r.url}): ${r.text ?? ""}`).join("\n").slice(0, 4000);
  } catch { return ""; }
}

export async function researchLead(userId: string, lead: Lead) {
  const search = await loadJson<SearchConfig>(userId, "search");
  const site = leadWebsite(lead);
  const name = `${lead.first_name} ${lead.last_name}`.trim();
  const searchQuery = `${name} ${lead.title ?? ""} ${lead.company}`.trim();
  const [siteText, searchText] = await Promise.all([
    site ? readWebsite(site) : Promise.resolve(""),
    // 1. Use the user's configured cloud search (Tavily / Exa / custom Siftdog URL) if set.
    // 2. Otherwise fall back to AceMail's built-in internal Siftdog instance automatically.
    (name || lead.company)
      ? (search
          ? webSearch(search, searchQuery)
          : internalSiftdogSearch(searchQuery))
      : Promise.resolve(""),
  ]);
  return { website: site, siteText, searchText };
}

export async function personalizeLinkedin(userId: string, cfg: LlmConfig, lead: Lead, instructions: string) {
  const r = await researchLead(userId, lead);
  const facts = { name: `${lead.first_name} ${lead.last_name}`.trim(), company: lead.company, title: lead.title, linkedin: lead.linkedin_url, other_fields: lead.custom_fields };
  const { text } = await chat(cfg, [
    { role: "system", content: "You write short, personal LinkedIn messages. Use only facts from the research; never invent anything. Sound human, no hype, no em dashes. Reply with JSON only: {\"message\": string (under 280 characters, friendly, mentions something specific, ends with a light question)}." },
    { role: "user", content: `Sender goal and instructions:\n${instructions || "Start a conversation."}\n\nLead:\n${JSON.stringify(facts)}\n\nCompany website (${r.website ?? "none"}):\n${r.siteText || "not available"}\n\nWeb search results:\n${r.searchText || "not available"}` },
  ]);
  const m = text.match(/\{[\s\S]*\}/);
  let parsed: { message?: string } = {};
  try { parsed = m ? JSON.parse(m[0]) : {}; } catch { /* handled below */ }
  if (!parsed.message) throw new Error("The AI reply could not be read. Try again.");
  return { message: parsed.message.slice(0, 300) };
}

export async function personalizeLead(userId: string, cfg: LlmConfig, lead: Lead, instructions: string) {
  const r = await researchLead(userId, lead);
  const facts = { name: `${lead.first_name} ${lead.last_name}`.trim(), email: lead.email, company: lead.company, title: lead.title, linkedin: lead.linkedin_url, other_fields: lead.custom_fields };
  const { text } = await chat(cfg, [
    { role: "system", content: "You write short, highly personalised cold outreach. Use only facts from the research; never invent achievements, numbers or news. Sound human, no hype, no em dashes. Reply with JSON only: {\"opener\": string (1-2 sentences referencing something specific about them or their company), \"subject\": string (under 7 words, lowercase feel), \"body\": string (under 120 words, plain text with line breaks, ends with a soft question)}." },
    { role: "user", content: `Sender goal and instructions:\n${instructions || "Start a conversation about how we can help them."}\n\nLead:\n${JSON.stringify(facts)}\n\nCompany website (${r.website ?? "none"}):\n${r.siteText || "not available"}\n\nWeb search results:\n${r.searchText || "not available"}` },
  ]);
  const m = text.match(/\{[\s\S]*\}/);
  let parsed: { opener?: string; subject?: string; body?: string } = {};
  try { parsed = m ? JSON.parse(m[0]) : {}; } catch { /* handled below */ }
  if (!parsed.opener && !parsed.body) throw new Error("The AI reply could not be read. Try again.");
  return { opener: parsed.opener ?? "", subject: parsed.subject ?? "", body: parsed.body ?? "", researched: Boolean(r.siteText || r.searchText) };
}
