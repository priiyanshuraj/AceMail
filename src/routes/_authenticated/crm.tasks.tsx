import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getCrmTasks, createCrmTask, updateCrmTask, deleteCrmTask, searchContacts } from "@/lib/crm.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Circle, Clock, Plus, Trash2, ArrowLeft, Search, Calendar, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const tasksQuery = () => queryOptions({ queryKey: ["crm-tasks"], queryFn: () => getCrmTasks({ data: {} }) });

export const Route = createFileRoute("/_authenticated/crm/tasks")({
  loader: ({ context }) => context.queryClient.ensureQueryData(tasksQuery()),
  head: () => ({ meta: [{ title: "Tasks | AceMail CRM" }] }),
  component: TasksPage,
});

const PRIORITY_BADGES: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
  medium: { label: "Medium", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  high: { label: "High", className: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  urgent: { label: "Urgent", className: "bg-red-500/10 text-red-500 border-red-500/20" },
};

function TasksPage() {
  const qc = useQueryClient();
  const { data: tasks } = useSuspenseQuery(tasksQuery());
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm-tasks"] });

  const [statusTab, setStatusTab] = useState<"pending" | "completed" | "all">("pending");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = tasks.filter((t) => {
    const isCompleted = t.status === "completed";
    const matchesTab = statusTab === "all" || (statusTab === "completed" ? isCompleted : !isCompleted);
    const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;
    const text = `${t.title} ${t.description ?? ""} ${t.contacts?.first_name ?? ""} ${t.contacts?.last_name ?? ""}`.toLowerCase();
    const matchesSearch = !search || text.includes(search.toLowerCase());
    return matchesTab && matchesPriority && matchesSearch;
  });

  const pendingCount = tasks.filter((t) => t.status !== "completed").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const urgentCount = tasks.filter((t) => t.status !== "completed" && t.priority === "urgent").length;

  const toggleTask = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "completed" ? "todo" : "completed";
    try {
      await updateCrmTask({ data: { id, status: nextStatus as any } });
      toast.success(nextStatus === "completed" ? "Task marked done" : "Task reopened");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/crm" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to CRM Overview
          </Link>
          <h1 className="mt-1 text-3xl font-bold">Tasks</h1>
          <p className="text-sm text-muted-foreground">Action items, to-dos, and follow-ups across your accounts</p>
        </div>
        <NewTaskDialog onDone={refresh} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Pending to-dos", val: pendingCount, sub: "Open tasks", icon: Circle },
          { label: "Completed", val: completedCount, sub: "Finished tasks", icon: CheckCircle2 },
          { label: "Urgent", val: urgentCount, sub: "High priority items", icon: AlertCircle },
          { label: "Total tasks", val: tasks.length, sub: "All time records", icon: Clock },
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 border rounded-lg p-1 bg-muted/40">
          <Button
            variant={statusTab === "pending" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setStatusTab("pending")}
          >
            Pending ({pendingCount})
          </Button>
          <Button
            variant={statusTab === "completed" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setStatusTab("completed")}
          >
            Completed ({completedCount})
          </Button>
          <Button
            variant={statusTab === "all" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setStatusTab("all")}
          >
            All ({tasks.length})
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border bg-card divide-y">
        {filtered.map((t) => {
          const isDone = t.status === "completed";
          const priorityInfo = PRIORITY_BADGES[t.priority] || PRIORITY_BADGES.medium!;
          const contactName = `${t.contacts?.first_name ?? ""} ${t.contacts?.last_name ?? ""}`.trim() || t.contacts?.email;
          return (
            <div key={t.id} className="p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors group">
              <button
                type="button"
                onClick={() => void toggleTask(t.id, t.status)}
                className="mt-0.5 text-muted-foreground hover:text-foreground shrink-0"
              >
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 fill-emerald-500/20" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </button>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-sm font-semibold ${isDone ? "line-through text-muted-foreground" : ""}`}>
                    {t.title}
                  </span>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityInfo.className}`}>
                    {priorityInfo.label}
                  </Badge>
                </div>

                {t.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                  {t.due_date && (
                    <span className="flex items-center gap-1 text-[11px]">
                      <Calendar className="h-3 w-3" /> Due {t.due_date}
                    </span>
                  )}
                  {contactName && (
                    <span className="text-[11px]">Contact: {contactName}</span>
                  )}
                  {t.crm_deals && (
                    <span className="text-[11px]">Deal: {t.crm_deals.title}</span>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={async () => {
                  try {
                    await deleteCrmTask({ data: { id: t.id } });
                    toast.success("Task deleted");
                    refresh();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed to delete");
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="p-12 text-center text-xs text-muted-foreground">
            No tasks found in this view. Click "+ Add Task" to create one.
          </div>
        )}
      </div>
    </div>
  );
}

function NewTaskDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; email: string; first_name: string; last_name: string; company: string }[]>([]);
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactLabel, setContactLabel] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    due_date: "",
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
    if (!form.title.trim()) {
      toast.error("Task title is required");
      return;
    }
    setBusy(true);
    try {
      await createCrmTask({
        data: {
          title: form.title.trim(),
          description: form.description || null,
          priority: form.priority,
          due_date: form.due_date || null,
          contact_id: contactId,
        },
      });
      toast.success("Task created");
      setOpen(false);
      setContactId(null);
      setContactLabel("");
      setQ("");
      setResults([]);
      setForm({ title: "", description: "", priority: "medium", due_date: "" });
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Add task</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Follow up on proposal with pricing breakdown"
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Add extra context or checklist..."
              className="text-xs"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as any })}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Link to Contact (optional)</Label>
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

          <Button className="w-full" disabled={busy} onClick={() => void submit()}>
            Create task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
