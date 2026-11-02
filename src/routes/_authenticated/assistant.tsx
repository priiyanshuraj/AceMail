import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, Loader2, Send, Wrench } from "lucide-react";
import { getAiStatus, runAssistant } from "@/lib/ai.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "AI Assistant | AceMail" },
      { name: "description", content: "Ask the AceMail assistant to manage contacts, templates, campaigns and write personalised outreach." },
      { property: "og:title", content: "AI Assistant | AceMail" },
      { property: "og:description", content: "Run AceMail from a chat using your own AI model." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
});

type Msg = { role: "user" | "assistant"; content: string; actions?: { tool: string; ok: boolean }[]; error?: boolean };
const KEY = "acemail-assistant-chat";
const SUGGESTIONS = [
  "Summarise my campaign results this week",
  "Write personalised openers for the first 10 contacts in my newest list",
  "Show replies in my inbox I haven't handled",
  "Create a follow-up template for people who opened but didn't reply",
];

function AssistantPage() {
  const { data: status } = useQuery({ queryKey: ["ai-status"], queryFn: () => getAiStatus() });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { try { setMsgs(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { /* ignore */ } }, []);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-40))); end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const next = [...msgs, { role: "user" as const, content: text.trim() }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const history = next.filter((m) => !m.error).slice(-20).map(({ role, content }) => ({ role, content }));
      const r = await runAssistant({ data: { messages: history } });
      setMsgs([...next, { role: "assistant", content: r.reply, actions: r.actions }]);
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong", error: true }]);
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl">AI Assistant</h1>
          <p className="text-sm text-muted-foreground">
            {status?.llm ? `Using ${status.llm.model}. It can act on your contacts, templates, campaigns, inbox and LinkedIn.` : "Connect your AI model to get started."}
          </p>
        </div>
        {msgs.length > 0 && <Button variant="outline" size="sm" onClick={() => setMsgs([])}>New chat</Button>}
      </div>

      {status && !status.llm && (
        <Card><CardContent className="p-4 text-sm">
          Add a DeepSeek, OpenAI, Claude or other API key in <Link to="/settings" className="underline">Settings</Link> under AI model.
        </CardContent></Card>
      )}

      <Card className="flex-1 overflow-hidden">
        <CardContent className="h-full space-y-4 overflow-y-auto p-4">
          {msgs.length === 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => void send(s)} disabled={!status?.llm} className="rounded-md border border-border p-3 text-left text-sm hover:bg-accent disabled:opacity-50">{s}</button>
              ))}
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex gap-2"}>
              {m.role === "assistant" && <Bot className="mt-1 h-5 w-5 shrink-0 text-primary" />}
              <div className={m.role === "user" ? "max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" : `max-w-[90%] text-sm ${m.error ? "text-destructive" : ""}`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
                {!!m.actions?.length && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.actions.map((a, j) => (
                      <span key={j} className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs ${a.ok ? "border-border text-muted-foreground" : "border-destructive text-destructive"}`}>
                        <Wrench className="h-3 w-3" />{a.tool.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Working…</div>}
          <div ref={end} />
        </CardContent>
      </Card>

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <Textarea rows={2} value={input} onChange={(e) => setInput(e.target.value)} disabled={!status?.llm}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
          placeholder="Ask AceMail to do anything…" className="resize-none" />
        <Button type="submit" disabled={busy || !input.trim()} className="h-auto"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}
