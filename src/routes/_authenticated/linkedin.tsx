import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listLinkedinSequences, saveLinkedinSequence, setLinkedinSequenceStatus, deleteLinkedinSequence,
  listLinkedinTasks, completeLinkedinTask, markLinkedinReplied, getRunnerToken, createRunnerToken, revokeRunnerToken, getLinkedinTracker, getCloudSession, saveCloudSession, deleteCloudSession,
} from "@/lib/outreach.functions";
import { listContactLists } from "@/lib/acemail.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, ExternalLink, Download, Hand, Bot, Pause, Play, Plus, Trash2, Check, SkipForward, MessageSquareReply, Pencil } from "lucide-react";
import { toast } from "sonner";

type Action = "visit" | "connect" | "message" | "follow" | "endorse";
type Step = { action: Action; delay_days: number; message?: string };
const ACTIONS: Record<Action, string> = {
  visit: "Visit profile", connect: "Send connection request", message: "Send message", follow: "Follow", endorse: "Endorse a skill",
};

const tasksQuery = queryOptions({ queryKey: ["linkedin-tasks"], queryFn: () => listLinkedinTasks() });
const seqQuery = queryOptions({ queryKey: ["linkedin-sequences"], queryFn: () => listLinkedinSequences() });
const listsQuery = queryOptions({ queryKey: ["contact-lists"], queryFn: () => listContactLists() });

export const Route = createFileRoute("/_authenticated/linkedin")({
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(tasksQuery), context.queryClient.ensureQueryData(seqQuery)]),
  head: () => ({
    meta: [
      { title: "LinkedIn outreach | AceMail" },
      { name: "description", content: "LinkedIn sequences with visits, connection requests and messages alongside your email campaigns." },
      { property: "og:title", content: "LinkedIn outreach | AceMail" },
      { property: "og:description", content: "LinkedIn sequences with visits, connection requests and messages alongside your email campaigns." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LinkedinPage,
});

function LinkedinPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">LinkedIn</h1>
        <p className="text-sm text-muted-foreground">
          Build sequences of profile visits, connection requests and messages. Do them yourself from a daily task list, or hand them to your own automation runner.
        </p>
      </div>
      <RunnerStatus />
      <Tabs defaultValue="today">
        <TabsList className="flex-wrap">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="sequences">Sequences</TabsTrigger>
          <TabsTrigger value="tracker">Tracker</TabsTrigger>
          <TabsTrigger value="runner">Connect LinkedIn</TabsTrigger>
        </TabsList>
        <TabsContent value="today"><TodayTasks /></TabsContent>
        <TabsContent value="sequences"><Sequences /></TabsContent>
        <TabsContent value="tracker"><Tracker /></TabsContent>
        <TabsContent value="runner"><Runner /></TabsContent>
      </Tabs>
    </div>
  );
}

function TodayTasks() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(tasksQuery);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["linkedin-tasks"] }); qc.invalidateQueries({ queryKey: ["linkedin-sequences"] }); };
  const finish = async (id: string, status: "done" | "skipped") => {
    try { await completeLinkedinTask({ data: { id, status } }); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not update"); }
  };
  if (data.length === 0) {
    return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nothing due right now. Start a sequence on the Sequences tab and today's steps show up here.</CardContent></Card>;
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{data.length} step{data.length === 1 ? "" : "s"} due. Open the profile, do the action on LinkedIn, then tick it off.</p>
      {data.map((t) => {
        const c = t.contacts as unknown as { first_name: string; last_name: string; company: string; title: string } | null;
        return (
          <Card key={t.id}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to="/contacts/$contactId" params={{ contactId: t.contact_id }} className="font-medium hover:underline">
                    {`${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim() || "Contact"}
                  </Link>
                  <Badge variant="outline">{ACTIONS[t.action as Action] ?? t.action}</Badge>
                  <span className="text-xs text-muted-foreground">{t.sequence_name} · step {t.step_index + 1}</span>
                </div>
                {(c?.title || c?.company) && <p className="text-xs text-muted-foreground">{[c?.title, c?.company].filter(Boolean).join(" at ")}</p>}
                {t.message && <p className="whitespace-pre-wrap rounded-md border bg-muted/40 p-2 text-sm">{t.message}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {t.message && (
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(t.message); toast.success("Message copied"); }}>
                    <Copy className="mr-1 h-4 w-4" /> Copy
                  </Button>
                )}
                <Button size="sm" variant="outline" asChild>
                  <a href={t.profile_url} target="_blank" rel="noreferrer noopener"><ExternalLink className="mr-1 h-4 w-4" /> Open profile</a>
                </Button>
                <Button size="sm" onClick={() => finish(t.id, "done")}><Check className="mr-1 h-4 w-4" /> Done</Button>
                <Button size="sm" variant="ghost" title="Skip this step" onClick={() => finish(t.id, "skipped")}><SkipForward className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" title="They replied: stop everything for this person" onClick={async () => {
                  await markLinkedinReplied({ data: { contactId: t.contact_id } }); toast.success("Stopped LinkedIn steps and emails for this person"); refresh();
                }}><MessageSquareReply className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

type SeqForm = { id?: string; name: string; list_id: string; mode: "assisted" | "runner"; steps: Step[]; daily_connect_limit: number; daily_message_limit: number };
const blank = (): SeqForm => ({
  name: "", list_id: "", mode: "assisted", daily_connect_limit: 20, daily_message_limit: 40,
  steps: [{ action: "visit", delay_days: 0 }, { action: "connect", delay_days: 1, message: "Hi {{first_name}}, would love to connect." }, { action: "message", delay_days: 3, message: "Thanks for connecting, {{first_name}}! {Quick|Short} question about {{company}}..." }],
});

function Sequences() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(seqQuery);
  const { data: lists } = useQuery(listsQuery);
  const [form, setForm] = useState<SeqForm | null>(null);
  const [saving, setSaving] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["linkedin-sequences"] }); qc.invalidateQueries({ queryKey: ["linkedin-tasks"] }); };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await saveLinkedinSequence({ data: form });
      toast.success("Sequence saved"); setForm(null); refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
    finally { setSaving(false); }
  };
  const setStep = (i: number, patch: Partial<Step>) => form && setForm({ ...form, steps: form.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setForm(blank())}><Plus className="mr-2 h-4 w-4" /> New sequence</Button></div>
      {data.sequences.length === 0 && <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No LinkedIn sequences yet. Contacts need a LinkedIn profile link (a "linkedin" column in your import works).</CardContent></Card>}
      {data.sequences.map((s) => {
        const st = data.stats[s.id] ?? { pending: 0, done: 0, skipped: 0, failed: 0, byStep: {} };
        const steps = s.steps as unknown as Step[];
        return (
          <Card key={s.id}>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">{s.name} <Badge variant="secondary">{s.status}</Badge> <Badge variant="outline">{s.mode === "runner" ? "Automated" : "Assisted"}</Badge></CardTitle>
                <CardDescription>{(s.contact_lists as { name: string } | null)?.name} · {s.daily_connect_limit} connects / {s.daily_message_limit} messages per day</CardDescription>
              </div>
              <div className="flex gap-2">
                {s.status === "running" ? (
                  <Button size="sm" variant="outline" onClick={async () => { await setLinkedinSequenceStatus({ data: { id: s.id, status: "paused" } }); refresh(); }}><Pause className="mr-1 h-4 w-4" /> Pause</Button>
                ) : (
                  <Button size="sm" onClick={async () => {
                    try { const r = await setLinkedinSequenceStatus({ data: { id: s.id, status: "running" } }); toast.success(r.added ? `${r.added} people queued` : "Sequence running"); refresh(); }
                    catch (e) { toast.error(e instanceof Error ? e.message : "Could not start"); }
                  }}><Play className="mr-1 h-4 w-4" /> Start</Button>
                )}
                <Button size="icon" variant="ghost" title="Edit" onClick={() => setForm({ id: s.id, name: s.name, list_id: s.list_id, mode: s.mode as "assisted", steps, daily_connect_limit: s.daily_connect_limit, daily_message_limit: s.daily_message_limit })}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" title="Delete" onClick={async () => { if (confirm("Delete this sequence and its tasks?")) { await deleteLinkedinSequence({ data: { id: s.id } }); refresh(); } }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>Waiting {st.pending}</span><span>Done {st.done}</span><span>Skipped {st.skipped}</span><span>Failed {st.failed}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {steps.map((step, i) => (
                  <div key={i} className="rounded-md border px-3 py-2 text-xs">
                    <p className="font-medium">{i + 1}. {ACTIONS[step.action]}</p>
                    <p className="text-muted-foreground">{i === 0 ? "Right away" : `+${step.delay_days}d`} · {st.byStep[i] ?? 0} done</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Edit sequence" : "New LinkedIn sequence"}</DialogTitle>
            <DialogDescription>Messages support {"{{first_name}}"}, {"{{company}}"}, any imported column, and spintax like {"{Hi|Hello}"}.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-1"><Label>Contact list</Label>
                  <Select value={form.list_id} onValueChange={(v) => setForm({ ...form, list_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose list" /></SelectTrigger>
                    <SelectContent>{(lists ?? []).map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label>Connects/day</Label><Input type="number" min={1} max={100} value={form.daily_connect_limit} onChange={(e) => setForm({ ...form, daily_connect_limit: Number(e.target.value) || 1 })} /></div>
                  <div className="space-y-1"><Label>Messages/day</Label><Input type="number" min={1} max={150} value={form.daily_message_limit} onChange={(e) => setForm({ ...form, daily_message_limit: Number(e.target.value) || 1 })} /></div>
                </div>
              </div>
              <div className="space-y-1">
                <Label>How should this sequence run?</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([["assisted", Hand, "Manual", "AceMail lists today's steps with the message ready. You click on LinkedIn. No account risk."], ["runner", Bot, "Automated", "Your connected LinkedIn runner visits, connects and messages for you, within your daily limits."]] as const).map(([m, Icon, title, desc]) => (
                    <button key={m} type="button" onClick={() => setForm({ ...form, mode: m })} className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 ${form.mode === m ? "border-primary ring-1 ring-primary" : ""}`}>
                      <p className="flex items-center gap-2 font-medium"><Icon className="h-4 w-4" /> {title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {form.steps.map((s, i) => (
                  <div key={i} className="space-y-2 rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">Step {i + 1}</span>
                      <Select value={s.action} onValueChange={(v) => setStep(i, { action: v as Action })}>
                        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(ACTIONS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                      {i > 0 && (<><Input type="number" className="w-20" min={0} max={90} value={s.delay_days} onChange={(e) => setStep(i, { delay_days: Math.max(0, Number(e.target.value) || 0) })} /><span className="text-xs text-muted-foreground">days after previous</span></>)}
                      <Button size="icon" variant="ghost" className="ml-auto" disabled={form.steps.length === 1} onClick={() => setForm({ ...form, steps: form.steps.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    {(s.action === "connect" || s.action === "message") && (
                      <Textarea rows={3} maxLength={s.action === "connect" ? 300 : 3000} placeholder={s.action === "connect" ? "Optional note (LinkedIn allows 300 characters)" : "Message"} value={s.message ?? ""} onChange={(e) => setStep(i, { message: e.target.value })} />
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" disabled={form.steps.length >= 15} onClick={() => setForm({ ...form, steps: [...form.steps, { action: "message", delay_days: 3, message: "" }] })}><Plus className="mr-1 h-4 w-4" /> Add step</Button>
              </div>
            </div>
          )}
          <DialogFooter><Button disabled={saving || !form?.name.trim() || !form?.list_id} onClick={save}>{saving ? "Saving…" : "Save sequence"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RunnerStatus() {
  const { data } = useQuery({ queryKey: ["linkedin-tracker"], queryFn: () => getLinkedinTracker(), refetchInterval: 60000 });
  if (!data) return null;
  const r = data.runner;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm glass">
      <span className={`h-2.5 w-2.5 rounded-full ${r.online ? "bg-primary" : "bg-muted-foreground/40"}`} />
      <span className="font-medium">{r.online ? "LinkedIn connected: runner online" : r.hasKey ? "LinkedIn runner offline" : "LinkedIn not connected for automation"}</span>
      <span className="text-muted-foreground">{r.lastSeen ? `Last seen ${new Date(r.lastSeen).toLocaleString()}` : "Manual sequences work without connecting."}</span>
      <span className="ml-auto text-muted-foreground">{data.waiting} steps waiting</span>
    </div>
  );
}

function Tracker() {
  const { data } = useQuery({ queryKey: ["linkedin-tracker"], queryFn: () => getLinkedinTracker(), refetchInterval: 60000 });
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const t = data.totals;
  const sent = t.connect;
  const stats = [["Profile visits", t.visit], ["Connection requests", t.connect], ["Messages sent", t.message], ["Follows", t.follow], ["Replies", t.replied], ["Failed", t.failed]] as const;
  const max = Math.max(1, ...data.days.map((d) => d.n));
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Last 14 days across manual and automated sequences.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([label, n]) => (
          <Card key={label}><CardContent className="p-4"><p className="eyebrow">{label}</p><p className="mt-1 text-2xl font-semibold">{n}</p></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Daily activity</CardTitle><CardDescription>{sent ? `Reply rate ${Math.round((t.replied / Math.max(1, t.message + t.connect)) * 100)}%` : "Steps completed per day"}</CardDescription></CardHeader>
        <CardContent>
          <div className="flex h-32 items-end gap-1">
            {data.days.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.n}`}>
                <div className="w-full rounded-t bg-primary/80" style={{ height: `${(d.n / max) * 100}%`, minHeight: d.n ? 4 : 1 }} />
                <span className="text-[10px] text-muted-foreground">{d.day.slice(8)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
        <CardContent className="divide-y p-0">
          {data.recent.length === 0 && <p className="p-6 text-sm text-muted-foreground">Nothing yet.</p>}
          {data.recent.map((r) => {
            const c = r.contacts as unknown as { first_name: string; last_name: string; company: string } | null;
            const seq = r.linkedin_sequences as unknown as { name: string; mode: string } | null;
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-6 py-2.5 text-sm">
                <Badge variant={r.status === "failed" ? "destructive" : r.status === "done" ? "secondary" : "outline"}>{r.status === "done" ? ACTIONS[r.action as Action] ?? r.action : r.note?.startsWith("Replied") ? "Replied" : r.status}</Badge>
                <Link to="/contacts/$contactId" params={{ contactId: r.contact_id }} className="hover:underline">{`${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim() || "Contact"}</Link>
                <span className="text-xs text-muted-foreground">{seq?.name} · {seq?.mode === "runner" ? "Automated" : "Manual"}{r.note ? ` · ${r.note}` : ""}</span>
                <span className="ml-auto text-xs text-muted-foreground">{r.completed_at ? new Date(r.completed_at).toLocaleString() : ""}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function Runner() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["runner-token"], queryFn: () => getRunnerToken() });
  const [token, setToken] = useState<string | null>(null);
  const here = typeof window !== "undefined" ? window.location.origin : "";
  const origin = !here || /localhost|id-preview--|lovableproject/.test(here) ? "https://acemail.online" : here;
  const cmd = `ACEMAIL_URL=${origin} ACEMAIL_KEY=${token ?? "<your key>"} node acemail-linkedin-runner.mjs`;
  const downloadExt = () => {
    fetch("/acemail-linkedin-extension.zip").then((r) => { if (!r.ok) throw new Error(`Download failed: ${r.status}`); return r.blob(); })
      .then((b) => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "acemail-linkedin-extension.zip"; a.click(); URL.revokeObjectURL(a.href); })
      .catch((e) => toast.error(e.message));
  };
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Step 1. Create your runner key</CardTitle>
          <CardDescription>Both the extension and the server use this key.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {data ? <span className="text-muted-foreground">Key active{data.last_used_at ? `, last used ${new Date(data.last_used_at).toLocaleString()}` : ", not used yet"}.</span> : null}
            <Button size="sm" onClick={async () => { const r = await createRunnerToken(); setToken(r.token); qc.invalidateQueries({ queryKey: ["runner-token"] }); qc.invalidateQueries({ queryKey: ["linkedin-tracker"] }); }}>{data ? "Replace key" : "Create key"}</Button>
            {data && <Button size="sm" variant="outline" onClick={async () => { await revokeRunnerToken(); setToken(null); qc.invalidateQueries({ queryKey: ["runner-token"] }); qc.invalidateQueries({ queryKey: ["linkedin-tracker"] }); }}>Disconnect</Button>}
          </div>
          {token && (
            <div className="flex gap-2 rounded-md border bg-muted/40 p-3"><code className="min-w-0 flex-1 break-all text-xs">{token}</code><Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(token); toast.success("Copied"); }}><Copy className="h-4 w-4" /></Button></div>
          )}
          {token && <p className="text-xs text-muted-foreground">Copy it now. It won't be shown again.</p>}
        </CardContent>
      </Card>

      <div>
        <p className="mb-2 text-sm font-medium">Step 2. Choose where it runs</p>
        <Tabs defaultValue="extension">
          <TabsList>
            <TabsTrigger value="extension">Chrome extension</TabsTrigger>
            <TabsTrigger value="server">Cloud server (24/7)</TabsTrigger>
            <TabsTrigger value="computer">My computer</TabsTrigger>
          </TabsList>
          <TabsContent value="extension">
            <Card>
              <CardHeader>
                <CardTitle>Chrome extension</CardTitle>
                <CardDescription>Easiest. Runs in your browser while it's open.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Button size="sm" onClick={downloadExt}><Download className="mr-2 h-4 w-4" /> Download extension</Button>
                <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                  <li>Unzip the file.</li>
                  <li>Open <code>chrome://extensions</code>.</li>
                  <li>Turn on Developer mode (top right).</li>
                  <li>Click Load unpacked, pick the folder.</li>
                  <li>Click the AceMail icon, paste your key, press Start.</li>
                  <li>Stay signed in to LinkedIn. Keep Chrome open.</li>
                </ol>
                <p className="text-xs text-muted-foreground">No tab to watch. It works in a pinned background tab. Chrome, Edge, Brave, Arc.</p>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="server"><CloudWorker origin={origin} /></TabsContent>
          <TabsContent value="computer">
            <Card>
              <CardHeader>
                <CardTitle>Run on my computer</CardTitle>
                <CardDescription>For Node.js users. Opens a browser window you sign in to.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Button size="sm" variant="outline" asChild><a href="/acemail-linkedin-runner.mjs" download><Download className="mr-2 h-4 w-4" /> Download runner</a></Button>
                <p className="text-xs text-muted-foreground">One-time: <code>npm i -g playwright && npx playwright install chromium</code></p>
                <div className="flex gap-2 rounded-md border bg-muted/40 p-3"><code className="min-w-0 flex-1 break-all text-xs">{cmd}</code><Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(cmd); toast.success("Copied"); }}><Copy className="h-4 w-4" /></Button></div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <p className="rounded-md border border-destructive/30 p-3 text-xs text-muted-foreground">LinkedIn forbids automation and can restrict accounts. Start with 10 to 20 connection requests a day.</p>
      <details className="rounded-lg border p-4 text-sm">
        <summary className="cursor-pointer font-medium">Using your own automation tool instead</summary>
        <pre className="mt-3 overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs">{`GET  ${origin}/api/public/linkedin/tasks   (Authorization: Bearer <key>)
POST ${origin}/api/public/linkedin/tasks
     { "taskId": "...", "status": "done" | "skipped" | "failed" | "later", "note": "...", "replied": false }`}</pre>
      </details>
    </div>
  );
}

function CloudWorker({ origin }: { origin: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["li-cloud"], queryFn: () => getCloudSession() });
  const [cookie, setCookie] = useState("");
  const [proxy, setProxy] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["li-cloud"] });
  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">Cloud worker (24/7, no PC needed)
          {data && <Badge variant={data.status === "expired" ? "destructive" : "secondary"}>{data.status === "expired" ? "Cookie expired" : `Connected ${data.hint ?? ""}`}</Badge>}
        </CardTitle>
        <CardDescription>Paste your LinkedIn session cookie (li_at). It is stored encrypted and only handed to your own worker, which uses your runner key below.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-2">
          <Label htmlFor="li-at">LinkedIn li_at cookie</Label>
          <Input id="li-at" type="password" autoComplete="off" value={cookie} onChange={(e) => setCookie(e.target.value)} placeholder={data ? "Paste a new cookie to replace" : "AQEDAR..."} />
          <Label htmlFor="li-proxy">Residential proxy (recommended)</Label>
          <Input id="li-proxy" autoComplete="off" value={proxy} onChange={(e) => setProxy(e.target.value)} placeholder="http://user:pass@host:port" />
          {data?.note && <p className="text-xs text-destructive">{data.note}</p>}
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || !cookie.trim()} onClick={async () => {
              setBusy(true);
              try { await saveCloudSession({ data: { cookie, proxy } }); setCookie(""); setProxy(""); toast.success("LinkedIn cookie saved"); refresh(); }
              catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
            }}>{data ? "Update cookie" : "Save cookie"}</Button>
            {data && <Button size="sm" variant="outline" onClick={async () => { await deleteCloudSession(); refresh(); }}>Remove</Button>}
          </div>
        </div>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">How to find your li_at cookie</summary>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>Open linkedin.com in Chrome while signed in.</li>
            <li>Press F12, open Application, then Cookies, then https://www.linkedin.com.</li>
            <li>Copy the value of <code>li_at</code>. Signing out of LinkedIn makes it stop working.</li>
          </ol>
        </details>
        <div className="space-y-1">
          <p className="font-medium">Deploy the worker (Railway, Render, Fly.io or any Docker host)</p>
          <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs">{`docker run -d --restart=always \\
  -e ACEMAIL_URL=${origin} \\
  -e ACEMAIL_KEY=<your runner key> \\
  -e CLOUD=1 -e HEADLESS=1 \\
  mcr.microsoft.com/playwright:v1.48.0-jammy \\
  sh -c "npm i playwright@1.48.0 && curl -fsSL ${origin}/acemail-linkedin-runner.mjs -o r.mjs && node r.mjs"`}</pre>
          <p className="text-xs text-muted-foreground">The worker loads your cookie and proxy from AceMail, so you only change them here. If LinkedIn signs the session out, this card shows "Cookie expired".</p>
        </div>
      </CardContent>
    </Card>
  );
}
