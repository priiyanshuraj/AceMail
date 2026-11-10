import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getCallLogs, createCallLog, deleteCallLog, searchContacts } from "@/lib/crm.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff, Plus, Trash2, ArrowLeft, Search, Clock, Users } from "lucide-react";
import { toast } from "sonner";

const callLogsQuery = () => queryOptions({ queryKey: ["crm-call-logs"], queryFn: () => getCallLogs({ data: {} }) });

export const Route = createFileRoute("/_authenticated/crm/call-logs")({
  loader: ({ context }) => context.queryClient.ensureQueryData(callLogsQuery()),
  head: () => ({ meta: [{ title: "Call Logs | AceMail CRM" }] }),
  component: CallLogsPage,
});

function formatDuration(sec: number): string {
  if (!sec) return "0s";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function CallLogsPage() {
  const qc = useQueryClient();
  const { data: logs } = useSuspenseQuery(callLogsQuery());
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm-call-logs"] });

  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = logs.filter((log) => {
    const matchesType = typeFilter === "all" || log.type === typeFilter;
    const matchesStatus = statusFilter === "all" || log.status === statusFilter;
    const contactText = `${log.contacts?.first_name ?? ""} ${log.contacts?.last_name ?? ""} ${log.contacts?.email ?? ""} ${log.phone_number ?? ""} ${log.summary ?? ""}`.toLowerCase();
    const matchesSearch = !search || contactText.includes(search.toLowerCase());
    return matchesType && matchesStatus && matchesSearch;
  });

  const totalDuration = logs.reduce((sum, l) => sum + (l.duration_seconds || 0), 0);
  const outboundCount = logs.filter((l) => l.type === "outbound").length;
  const inboundCount = logs.filter((l) => l.type === "inbound").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/crm" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to CRM Overview
          </Link>
          <h1 className="mt-1 text-3xl font-bold">Call Logs</h1>
          <p className="text-sm text-muted-foreground">Track sales touchpoints, call recordings, and talk time</p>
        </div>
        <NewCallLogDialog onDone={refresh} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total calls", val: logs.length, sub: "All time logs", icon: PhoneCall },
          { label: "Outbound", val: outboundCount, sub: "Calls made", icon: PhoneOutgoing },
          { label: "Inbound", val: inboundCount, sub: "Calls received", icon: PhoneIncoming },
          { label: "Total talk time", val: formatDuration(totalDuration), sub: "Logged duration", icon: Clock },
        ].map(({ label, val, sub, icon: Icon }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{label}</span>
              <Icon className="h-4 w-4" />
            </div>
            <p className="mt-2 text-2xl font-bold">{val}</p>
            <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search phone, contact name, or notes..."
            className="pl-9 text-xs"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px] text-xs"><SelectValue placeholder="Call Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] text-xs"><SelectValue placeholder="Call Outcome" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Outcomes</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="missed">Missed</SelectItem>
            <SelectItem value="busy">Busy</SelectItem>
            <SelectItem value="voicemail">Voicemail</SelectItem>
            <SelectItem value="no_answer">No Answer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Contact / Deal</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((log) => {
              const contactName = `${log.contacts?.first_name ?? ""} ${log.contacts?.last_name ?? ""}`.trim() || log.contacts?.email || "—";
              return (
                <TableRow key={log.id}>
                  <TableCell>
                    {log.type === "inbound" ? (
                      <span className="flex items-center gap-1.5 text-xs text-sky-500 font-medium">
                        <PhoneIncoming className="h-3.5 w-3.5" /> Inbound
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                        <PhoneOutgoing className="h-3.5 w-3.5" /> Outbound
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{contactName}</p>
                      {log.crm_deals && (
                        <p className="text-[11px] text-muted-foreground truncate">{log.crm_deals.title}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.phone_number || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{formatDuration(log.duration_seconds)}</TableCell>
                  <TableCell>
                    <Badge variant={log.status === "completed" ? "default" : "outline"} className="capitalize text-[11px]">
                      {log.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs max-w-[280px] truncate text-muted-foreground">
                    {log.summary || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.started_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        try {
                          await deleteCallLog({ data: { id: log.id } });
                          toast.success("Call log deleted");
                          refresh();
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Failed to delete");
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-xs text-muted-foreground">
                  No call logs found. Click "+ Log Call" to record a conversation.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function NewCallLogDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; email: string; first_name: string; last_name: string; company: string }[]>([]);
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactLabel, setContactLabel] = useState("");
  const [form, setForm] = useState({
    type: "outbound" as "inbound" | "outbound",
    status: "completed" as "completed" | "missed" | "busy" | "no_answer" | "voicemail",
    phone_number: "",
    duration_seconds: 60,
    summary: "",
  });
  const [busy, setBusy] = useState(false);

  const search = async (term: string) => {
    setQ(term);
    try {
      setResults(await searchContacts({ data: { q: term } }));
    } catch {
      /* ignore */
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      await createCallLog({
        data: {
          contact_id: contactId,
          type: form.type,
          status: form.status,
          phone_number: form.phone_number || null,
          duration_seconds: Number(form.duration_seconds) || 0,
          summary: form.summary || null,
        },
      });
      toast.success("Call logged");
      setOpen(false);
      setContactId(null);
      setContactLabel("");
      setQ("");
      setResults([]);
      setForm({ type: "outbound", status: "completed", phone_number: "", duration_seconds: 60, summary: "" });
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log call");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Log call</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Log a Call</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Contact (optional)</Label>
            {contactId ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                <span className="truncate">{contactLabel}</span>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setContactId(null)}>Change</Button>
              </div>
            ) : (
              <>
                <Input value={q} onChange={(e) => void search(e.target.value)} placeholder="Search contact by name or email..." className="text-xs" />
                {results.length > 0 && (
                  <div className="max-h-36 divide-y overflow-y-auto rounded-md border text-xs">
                    {results.map((r) => (
                      <button
                        key={r.id}
                        className="block w-full px-3 py-1.5 text-left hover:bg-accent"
                        onClick={() => {
                          setContactId(r.id);
                          setContactLabel(`${`${r.first_name} ${r.last_name}`.trim() || r.email}`);
                        }}
                      >
                        {`${r.first_name} ${r.last_name}`.trim() || r.email}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Call Direction</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outbound">Outbound</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Call Outcome</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed / Answered</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                  <SelectItem value="busy">Busy</SelectItem>
                  <SelectItem value="voicemail">Left Voicemail</SelectItem>
                  <SelectItem value="no_answer">No Answer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone number</Label>
              <Input
                value={form.phone_number}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                placeholder="+1 555 0192"
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (seconds)</Label>
              <Input
                type="number"
                min={0}
                value={form.duration_seconds}
                onChange={(e) => setForm({ ...form, duration_seconds: Number(e.target.value) || 0 })}
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Call notes & outcome</Label>
            <Textarea
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              placeholder="Discussed pricing and agreed to demo next Tuesday..."
              className="text-xs"
              rows={3}
            />
          </div>

          <Button className="w-full" disabled={busy} onClick={() => void submit()}>
            Save call log
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
