import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getLead, updateLead, deleteLead, convertLeadToDeal, createActivity, updateActivity, deleteActivity, searchContacts } from "@/lib/crm.functions";
import { fmtMoney, stageColor } from "@/lib/crm-colors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Check, Plus, Trash2, CalendarDays, Activity, Phone, Users, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const leadQuery = (id: string) => queryOptions({ queryKey: ["crm-lead", id], queryFn: () => getLead({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/crm/leads/$leadId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(leadQuery(params.leadId)),
  head: () => ({ meta: [{ title: "Lead Detail | AceMail CRM" }] }),
  component: LeadDetailPage,
});

function LeadDetailPage() {
  const { leadId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(leadQuery(leadId));
  const { lead, stages, activities } = data;
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm-lead", leadId] });

  const [f, setF] = useState({
    title: lead.title,
    description: lead.description ?? "",
    status: lead.status,
    lead_value: lead.lead_value ? String(lead.lead_value) : "",
    expected_close: lead.expected_close ?? "",
    first_name: lead.first_name ?? "",
    last_name: lead.last_name ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    company: lead.company ?? "",
    stage_id: lead.stage_id ?? "",
  });

  const saveLead = async () => {
    try {
      await updateLead({
        data: {
          id: lead.id,
          title: f.title,
          description: f.description || null,
          status: f.status as "new" | "in_progress" | "converted" | "lost",
          lead_value: Number(f.lead_value) || 0,
          expected_close: f.expected_close || null,
          first_name: f.first_name || null,
          last_name: f.last_name || null,
          email: f.email || null,
          phone: f.phone || null,
          company: f.company || null,
          stage_id: f.stage_id || null,
        },
      });
      toast.success("Lead updated");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update lead");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/crm/leads" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to Leads
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-2xl font-bold">{lead.title}</h1>
            <Badge variant={lead.status === "converted" ? "outline" : lead.status === "lost" ? "destructive" : "secondary"}>
              {lead.status}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {lead.status !== "converted" && (
            <ConvertLeadDialog leadId={lead.id} leadName={lead.title} stages={stages} onConverted={() => refresh()} />
          )}
          {lead.deal_id && (
            <Button variant="outline" asChild>
              <Link to="/crm/pipeline">View in Pipeline <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            aria-label="Delete lead"
            onClick={async () => {
              if (!confirm("Are you sure you want to delete this lead?")) return;
              try {
                await deleteLead({ data: { id: lead.id } });
                toast.success("Lead deleted");
                navigate({ to: "/crm/leads" });
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not delete");
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        {/* Left Column: Lead Info Form */}
        <Card>
          <CardHeader><CardTitle className="text-base">Lead Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} onBlur={saveLead} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>First name</Label>
                <Input value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} onBlur={saveLead} />
              </div>
              <div className="space-y-1">
                <Label>Last name</Label>
                <Input value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} onBlur={saveLead} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Email</Label>
                <Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} onBlur={saveLead} />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} onBlur={saveLead} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Company</Label>
                <Input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} onBlur={saveLead} />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={f.status} onValueChange={(v) => { setF({ ...f, status: v }); void updateLead({ data: { id: lead.id, status: v as any } }).then(refresh); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Value</Label>
                <Input type="number" value={f.lead_value} onChange={(e) => setF({ ...f, lead_value: e.target.value })} onBlur={saveLead} />
              </div>
              <div className="space-y-1">
                <Label>Expected close</Label>
                <Input type="date" value={f.expected_close} onChange={(e) => setF({ ...f, expected_close: e.target.value })} onBlur={saveLead} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Pipeline stage</Label>
              <Select value={f.stage_id} onValueChange={(v) => { setF({ ...f, stage_id: v }); void updateLead({ data: { id: lead.id, stage_id: v } }).then(refresh); }}>
                <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Description / Notes</Label>
              <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} onBlur={saveLead} rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Activities for this Lead */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" /> Activities
              </CardTitle>
              <NewActivityDialog leadId={lead.id} onDone={refresh} />
            </CardHeader>
            <CardContent className="space-y-2">
              {activities.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">No activities logged yet.</p>
              )}
              {activities.map((a) => (
                <div key={a.id} className="flex items-start gap-2.5 rounded-md border p-2.5">
                  <button
                    className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={async () => {
                      try {
                        await updateActivity({ data: { id: a.id, done: !a.done } });
                        refresh();
                      } catch (err) {
                        toast.error("Could not update");
                      }
                    }}
                  >
                    <CheckCircle2 className={`h-4 w-4 ${a.done ? "text-green-500" : "text-muted-foreground/40"}`} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-medium ${a.done ? "line-through opacity-60" : ""}`}>{a.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <Badge variant="outline" className="text-[10px] capitalize py-0 px-1.5">{a.type}</Badge>
                      {a.schedule_from && <span>{new Date(a.schedule_from).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={async () => {
                      try {
                        await deleteActivity({ data: { id: a.id } });
                        refresh();
                      } catch {
                        toast.error("Could not delete activity");
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ConvertLeadDialog({ leadId, leadName, stages, onConverted }: { leadId: string; leadName: string; stages: { id: string; name: string }[]; onConverted: () => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; email: string; first_name: string; last_name: string; company: string }[]>([]);
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactLabel, setContactLabel] = useState("");
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const search = async (term: string) => {
    setQ(term);
    try {
      setResults(await searchContacts({ data: { q: term } }));
    } catch {}
  };

  const submit = async () => {
    if (!contactId) {
      toast.error("Please pick a contact to link this deal to");
      return;
    }
    setBusy(true);
    try {
      await convertLeadToDeal({
        data: {
          lead_id: leadId,
          contact_id: contactId,
          stage_id: stageId || undefined,
        },
      });
      toast.success("Lead converted to active deal!");
      setOpen(false);
      onConverted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Conversion failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default"><Check className="mr-1.5 h-4 w-4" /> Convert to deal</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Convert Lead: {leadName}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            Converting this lead will create an active deal in your sales pipeline. Select the client profile to assign it to:
          </p>
          <div className="space-y-2">
            <Label>Contact</Label>
            {contactId ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="truncate">{contactLabel}</span>
                <Button variant="ghost" size="sm" onClick={() => setContactId(null)}>Change</Button>
              </div>
            ) : (
              <>
                <Input value={q} onChange={(e) => void search(e.target.value)} placeholder="Search existing contacts..." />
                <div className="max-h-40 divide-y overflow-y-auto rounded-md border">
                  {results.map((r) => (
                    <button
                      key={r.id}
                      className="block w-full px-3 py-2 text-left text-xs hover:bg-accent"
                      onClick={() => {
                        setContactId(r.id);
                        setContactLabel(`${`${r.first_name} ${r.last_name}`.trim() || r.email}${r.company ? ` · ${r.company}` : ""}`);
                      }}
                    >
                      {`${r.first_name} ${r.last_name}`.trim() || r.email}
                      <span className="text-muted-foreground">{r.company ? ` · ${r.company}` : ""}</span>
                    </button>
                  ))}
                  {results.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Search by name, email or company.</p>}
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label>Pipeline stage</Label>
            <Select value={stageId} onValueChange={setStageId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full" disabled={busy || !contactId} onClick={() => void submit()}>
            Confirm & Convert to Deal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewActivityDialog({ leadId, onDone }: { leadId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ type: "call", title: "", schedule_from: "", description: "" });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!f.title.trim()) return;
    setBusy(true);
    try {
      await createActivity({
        data: {
          lead_id: leadId,
          type: f.type as any,
          title: f.title.trim(),
          schedule_from: f.schedule_from ? new Date(f.schedule_from).toISOString() : null,
          description: f.description.trim() || null,
        },
      });
      toast.success("Activity logged");
      setOpen(false);
      setF({ type: "call", title: "", schedule_from: "", description: "" });
      onDone();
    } catch {
      toast.error("Could not create activity");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Plus className="mr-1 h-3.5 w-3.5" /> Log activity</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Log Activity</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Date & Time</Label>
              <Input type="datetime-local" value={f.schedule_from} onChange={(e) => setF({ ...f, schedule_from: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Title *</Label>
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Discovery call" />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Details..." rows={2} />
          </div>
          <Button className="w-full" disabled={busy || !f.title.trim()} onClick={() => void submit()}>Save Activity</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
