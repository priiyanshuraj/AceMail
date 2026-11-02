import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getAiStatus, saveAiModel, saveSearchKey, testAiModel } from "@/lib/ai.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const PROVIDERS = [
  { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
  { id: "anthropic", label: "Claude", baseUrl: "https://api.anthropic.com/v1", model: "claude-sonnet-4-5" },
  { id: "custom", label: "Other", baseUrl: "", model: "" },
] as const;
type P = (typeof PROVIDERS)[number]["id"];

export function AiModelCard() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["ai-status"], queryFn: () => getAiStatus() });
  const [provider, setProvider] = useState<P>("deepseek");
  const [baseUrl, setBaseUrl] = useState<string>(PROVIDERS[0].baseUrl);
  const [model, setModel] = useState<string>(PROVIDERS[0].model);
  const [key, setKey] = useState("");
  const [searchProvider, setSearchProvider] = useState<"tavily" | "exa">("tavily");
  const [searchKey, setSearchKey] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.llm) { setProvider(data.llm.provider); setBaseUrl(data.llm.baseUrl); setModel(data.llm.model); }
    if (data?.search && (data.search.provider === "tavily" || data.search.provider === "exa")) {
      setSearchProvider(data.search.provider);
    }
  }, [data]);

  const pick = (id: P) => {
    const p = PROVIDERS.find((x) => x.id === id)!;
    setProvider(id); setBaseUrl(p.baseUrl); setModel(p.model);
  };
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); qc.invalidateQueries({ queryKey: ["ai-status"] }); toast.success(ok); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI model</CardTitle>
        <CardDescription>
          Connect your own AI (DeepSeek, OpenAI, Claude or any compatible service). It powers the AI assistant and writes personalised messages for each lead. Usage is billed by your provider. Keys are stored encrypted.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data?.llm && <p className="text-sm">Connected: <b>{data.llm.model}</b>, key ending <span className="font-mono">…{data.llm.hint}</span></p>}
        <div className="flex flex-wrap gap-2">
          {PROVIDERS.map((p) => (
            <Button key={p.id} type="button" size="sm" variant={provider === p.id ? "default" : "outline"} onClick={() => pick(p.id)}>{p.label}</Button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>API address</Label><Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" /></div>
          <div className="space-y-1"><Label>Model</Label><Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="model name" /></div>
        </div>
        <div className="space-y-1">
          <Label>API key</Label>
          <Input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={data?.llm ? "Leave empty to keep current key" : "Paste your API key"} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => run(async () => { await saveAiModel({ data: { provider, baseUrl, model, key } }); setKey(""); }, "AI model saved")}>Save</Button>
          {data?.llm && <Button variant="outline" disabled={busy} onClick={() => run(async () => { const r = await testAiModel(); toast.message(`Model replied: ${r.reply}`); }, "Connection works")}>Test</Button>}
          {data?.llm && <Button variant="outline" disabled={busy} onClick={() => run(() => saveAiModel({ data: { provider, baseUrl, model, remove: true } }), "AI model removed")}>Remove</Button>}
        </div>

        <div className="border-t border-border pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Web search for lead research</p>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium">
              Built-in Search Active
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            AceMail has built-in web search for automatic, private lead research without third-party API costs or external containers. You can optionally connect an external Tavily or Exa key below if desired.
          </p>
          {data?.search && <p className="text-sm">Active search override: <b>{data.search.provider}</b>{data.search.hint ? ` (key …${data.search.hint})` : ""}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex gap-2">
              {(["tavily", "exa"] as const).map((s) => (
                <Button key={s} size="sm" variant={searchProvider === s ? "default" : "outline"} onClick={() => setSearchProvider(s)}>{s === "tavily" ? "Tavily" : "Exa"}</Button>
              ))}
            </div>
            <Input type="password" autoComplete="off" value={searchKey} onChange={(e) => setSearchKey(e.target.value)} placeholder="Search API key" />
            <Button disabled={busy || !searchKey.trim()} onClick={() => run(async () => { await saveSearchKey({ data: { provider: searchProvider, key: searchKey } }); setSearchKey(""); }, "Search provider saved")}>Save</Button>
            {data?.search && <Button variant="outline" disabled={busy} onClick={() => run(() => saveSearchKey({ data: { provider: searchProvider, key: "" } }), "Search key removed")}>Remove</Button>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
