import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getActivities, createActivity, updateActivity, deleteActivity, searchContacts } from "@/lib/crm.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, ArrowLeft, Calendar, CheckCircle2, Coffee, Mail, Phone, Plus, Search, Trash2, User, Clock } from "lucide-react";
import { toast } from "sonner";

const activitiesQuery = () => queryOptions({ queryKey: ["crm-activities"], queryFn: () => getActivities({ data: {} }) });

export const Route = createFileRoute("/_authenticated/crm/activities")({
  loader: ({ context }) => context.queryClient.ensureQueryData(activitiesQuery()),
  head: () => ({ meta: [{ title: "Activities | AceMail CRM" }] }),
  component: ActivitiesPage,
});

const TYPE_ICONS: Record<string, any> = {
  call: Phone,
  meeting: Calendar,
  lunch: Coffee,
  task: CheckCircle2,
  email: Mail,
};

function ActivitiesPage() {
  const qc = useQueryClient();
  const { data: activities } = useSuspenseQuery(activitiesQuery());
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm-activities"] });

  const [tab, setTab] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const filtered = activities.filter((a) => {
    if (tab === "today") {
      if (!a.schedule_from || !a.schedule_from.startsWith(todayStr)) return false;
    } else if (tab === "upcoming") {
      if (a.done || !a.schedule_from || new Date(a.schedule_from) < now) return false;
    } else if (tab === "completed") {
      if (!a.done) return false;
    }

    if (typeFilter !== "all" && a.type !== typeFilter) return false;

    const contact = a.contacts as { first_name: string; last_name: string; email: string; company: string } | null;
    const text = `${a.title} ${a.description ?? ""} ${contact?.first_name ?? ""} ${contact?.last_name ?? ""} ${contact?.company ?? ""}`.toLowerCase();
    if (search && !text.includes(search.toLowerCase())) return false;

    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/crm" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to CRM Overview
          </Link>
          <h1 className="mt-1 text-3xl font-bold">Activities</h1>
          <p className="text-sm text-muted-foreground">Keep track of client calls, meetings, lunches, and tasks</p>
        </div>
        <NewActivityDialog onDone={refresh} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex flex-wrap gap-1">
          {[
            { id: "all", label: "All" },
            { id: "today", label: "Today" },
            { id: "upcoming", label: "Upcoming" },
            { id: "completed", label: "Completed" },
          ].map((t) => (
            <Button
              key={t.id}
              variant={tab === t.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTab(t.id)}
              className="text-xs"
            >
              {t.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-32 text-xs"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="call">Calls</SelectItem>
              <SelectItem value="meeting">Meetings</SelectItem>
              <SelectItem value="lunch">Lunches</SelectItem>
              <SelectItem value="task">Tasks</SelectItem>
              <SelectItem value="email">Emails</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative w-48">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="h-9 pl-8 text-xs" placeholder="Search activities..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Activities List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground mb-3">
              <Activity className="h-6 w-6" />
            </div>
            <h3 className="font-semibold">No activities found</h3>
            <p className="mt-1 text-xs text-muted-foreground">Schedule a follow-up or client meeting to keep touchpoints active.</p>
          </Card>
        ) : (
          filtered.map((a) => {
            const Icon = TYPE_ICONS[a.type] ?? Activity;
            const contact = a.contacts as { id: string; first_name: string; last_name: string; email: string; company: string } | null;
            const deal = a.crm_deals as { id: string; title: string } | null;
            return (
              <div
                key={a.id}
                className={`flex items-start justify-between gap-3 rounded-lg border p-3.5 transition-colors hover:bg-accent/40 ${
                  a.done ? "opacity-60 bg-muted/20" : ""
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={async () => {
                      try {
                        await updateActivity({ data: { id: a.id, done: !a.done } });
                        refresh();
                      } catch {
                        toast.error("Could not update activity");
                      }
                    }}
                  >
                    <CheckCircle2 className={`h-5 w-5 ${a.done ? "text-green-500" : "text-muted-foreground/30 hover:text-muted-foreground"}`} />
                  </button>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm font-medium ${a.done ? "line-through text-muted-foreground" : ""}`}>{a.title}</span>
                      <Badge variant="outline" className="gap-1 text-[11px] capitalize">
                        <Icon className="h-3 w-3" />
                        {a.type}
                      </Badge>
                      {deal && (
                        <span className="text-xs text-muted-foreground">
                          Deal: <span className="font-medium">{deal.title || "Untitled"}</span>
                        </span>
                      )}
                    </div>

                    {a.description && <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                      {contact && (
                        <Link to="/crm/clients/$contactId" params={{ contactId: contact.id }} className="flex items-center gap-1 hover:text-foreground hover:underline">
                          <User className="h-3 w-3" />
                          {`${contact.first_name} ${contact.last_name}`.trim() || contact.email}
                          {contact.company && ` (${contact.company})`}
                        </Link>
                      )}
                      {a.schedule_from && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(a.schedule_from).toLocaleString()}
                        </span>
                      )}
                      {a.location && <span>📍 {a.location}</span>}
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={async () => {
                    try {
                      await deleteActivity({ data: { id: a.id } });
                      toast.success("Activity deleted");
                      refresh();
                    } catch {
                      toast.error("Could not delete activity");
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function NewActivityDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    type: "call",
    title: "",
    description: "",
    location: "",
    schedule_from: "",
    schedule_to: "",
  });
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; email: string; first_name: string; last_name: string; company: string }[]>([]);
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactLabel, setContactLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const search = async (term: string) => {
    setQ(term);
    try {
      setResults(await searchContacts({ data: { q: term } }));
    } catch {}
  };

  const submit = async () => {
    if (!f.title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    setBusy(true);
    try {
      await createActivity({
        data: {
          type: f.type as any,
          title: f.title.trim(),
          description: f.description.trim() || null,
          location: f.location.trim() || null,
          schedule_from: f.schedule_from ? new Date(f.schedule_from).toISOString() : null,
          schedule_to: f.schedule_to ? new Date(f.schedule_to).toISOString() : null,
          contact_id: contactId,
        },
      });
      toast.success("Activity scheduled");
      setOpen(false);
      setF({ type: "call", title: "", description: "", location: "", schedule_from: "", schedule_to: "" });
      setContactId(null);
      setContactLabel("");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Schedule activity</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Schedule Activity</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Activity Type</Label>
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
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Contract review call" />
          </div>

          <div className="space-y-1">
            <Label>Linked Contact (optional)</Label>
            {contactId ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-1.5 text-xs">
                <span className="truncate">{contactLabel}</span>
                <Button variant="ghost" size="sm" onClick={() => setContactId(null)}>Change</Button>
              </div>
            ) : (
              <>
                <Input value={q} onChange={(e) => void search(e.target.value)} placeholder="Search contacts..." className="h-8 text-xs" />
                {results.length > 0 && (
                  <div className="max-h-32 divide-y overflow-y-auto rounded-md border text-xs">
                    {results.map((r) => (
                      <button
                        key={r.id}
                        className="block w-full px-2.5 py-1.5 text-left hover:bg-accent"
                        onClick={() => {
                          setContactId(r.id);
                          setContactLabel(`${`${r.first_name} ${r.last_name}`.trim() || r.email}`);
                          setResults([]);
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

          <div className="space-y-1">
            <Label>Location / Meeting Link</Label>
            <Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Zoom / Google Meet / Office" />
          </div>

          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Agenda, talking points..." rows={2} />
          </div>

          <Button className="w-full mt-2" disabled={busy || !f.title.trim()} onClick={() => void submit()}>
            Schedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
