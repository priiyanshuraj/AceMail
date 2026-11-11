import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getLeads, createLead, deleteLead } from "@/lib/crm.functions";
import { fmtMoney, stageColor } from "@/lib/crm-colors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Search, Zap, ArrowLeft, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { ImportContactsDialog, ContactPrefill } from "@/components/crm/ImportContactsToLeads";

const leadsQuery = () => queryOptions({ queryKey: ["crm-leads"], queryFn: () => getLeads({ data: { q: "" } }) });

export const Route = createFileRoute("/_authenticated/crm/leads/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(leadsQuery()),
  head: () => ({ meta: [{ title: "Leads | AceMail CRM" }] }),
  component: LeadsPage,
});

const STATUS_VARIANTS: Record<string, { label: string; badge: "default" | "secondary" | "outline" | "destructive" }> = {
  new: { label: "New", badge: "default" },
  in_progress: { label: "In Progress", badge: "secondary" },
  converted: { label: "Converted", badge: "outline" },
  lost: { label: "Lost", badge: "destructive" },
};

function LeadsPage() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(leadsQuery());
  const { leads, stages } = data;
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm-leads"] });

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = leads.filter((l) => {
    const matchesStatus = statusFilter === "all" || l.status === statusFilter;
    const text = `${l.title} ${l.first_name ?? ""} ${l.last_name ?? ""} ${l.email ?? ""} ${l.company ?? ""}`.toLowerCase();
    const matchesSearch = !search || text.includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const countByStatus = (st: string) => leads.filter((l) => l.status === st).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/crm" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to CRM Overview
          </Link>
          <h1 className="mt-1 text-3xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">Manage incoming opportunities before converting to deals</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportContactsDialog onDone={refresh} />
          <NewLeadDialog stages={stages} onDone={refresh} />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "all", label: "All", count: leads.length },
            { id: "new", label: "New", count: countByStatus("new") },
            { id: "in_progress", label: "In Progress", count: countByStatus("in_progress") },
            { id: "converted", label: "Converted", count: countByStatus("converted") },
            { id: "lost", label: "Lost", count: countByStatus("lost") },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={statusFilter === tab.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter(tab.id)}
              className="text-xs"
            >
              {tab.label} <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono">{tab.count}</span>
            </Button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="h-9 pl-9 text-xs" placeholder="Search leads..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Contact / Company</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expected Close</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-muted">
                    <Zap className="h-5 w-5 text-muted-foreground" />
                  </div>
                  {search ? "No leads matched your search." : "No leads in this view."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((lead) => {
              const stage = stages.find((s) => s.id === lead.stage_id);
              const contactName = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim();
              const sv = STATUS_VARIANTS[lead.status] ?? { label: lead.status, badge: "outline" as const };
              return (
                <TableRow key={lead.id}>
                  <TableCell>
                    <Link to="/crm/leads/$leadId" params={{ leadId: lead.id }} className="font-medium hover:text-primary hover:underline">
                      {lead.title}
                    </Link>
                    {lead.description && <p className="truncate max-w-xs text-xs text-muted-foreground">{lead.description}</p>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {contactName || lead.company || lead.email ? (
                      <div>
                        <p className="font-medium text-xs">{contactName || lead.company}</p>
                        <p className="text-[11px] text-muted-foreground">{lead.email || lead.phone}</p>
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {stage ? (
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className={`h-2 w-2 rounded-full ${stageColor(stage.color).dot}`} />
                        {stage.name}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm font-medium tabular-nums">
                    {Number(lead.lead_value) > 0 ? fmtMoney(Number(lead.lead_value), lead.currency) : "—"}
                  </TableCell>
                  <TableCell className="text-xs capitalize text-muted-foreground">{lead.source ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={sv.badge} className="capitalize text-[11px]">{sv.label}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {lead.expected_close ? (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {new Date(`${lead.expected_close}T12:00:00`).toLocaleDateString()}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      aria-label="Delete lead"
                      onClick={async () => {
                        try {
                          await deleteLead({ data: { id: lead.id } });
                          toast.success("Lead deleted");
                          refresh();
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Could not delete");
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function NewLeadDialog({ stages, onDone }: { stages: { id: string; name: string }[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    title: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company: "",
    source: "website",
    lead_value: "",
    currency: "USD",
    expected_close: "",
    stage_id: stages[0]?.id ?? "",
    description: "",
  });
  const [contactId, setContactId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!f.title.trim()) {
      toast.error("Please enter a lead title");
      return;
    }
    setBusy(true);
    try {
      await createLead({
        data: {
          title: f.title.trim(),
          first_name: f.first_name.trim() || null,
          last_name: f.last_name.trim() || null,
          email: f.email.trim() || null,
          phone: f.phone.trim() || null,
          company: f.company.trim() || null,
          source: f.source || null,
          type: "inbound",
          lead_value: Number(f.lead_value) || 0,
          currency: f.currency || "USD",
          expected_close: f.expected_close || null,
          stage_id: f.stage_id || null,
          description: f.description.trim() || null,
          contact_id: contactId,
        },
      });
      toast.success("Lead created");
      setOpen(false);
      setContactId(null);
      setF({
        title: "",
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        company: "",
        source: "website",
        lead_value: "",
        currency: "USD",
        expected_close: "",
        stage_id: stages[0]?.id ?? "",
        description: "",
      });
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create lead");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> New lead</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create new lead</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <ContactPrefill
            onPick={(c) => {
              setContactId(c.id);
              const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
              setF((prev) => ({
                ...prev,
                title: prev.title || [name || c.email, c.company].filter(Boolean).join(" · "),
                first_name: c.first_name ?? "",
                last_name: c.last_name ?? "",
                email: c.email ?? "",
                phone: c.phone ?? "",
                company: c.company ?? "",
              }));
            }}
          />
          <div className="space-y-1">
            <Label>Lead Title *</Label>
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Enterprise pilot evaluation" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>First name</Label>
              <Input value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Last name</Label>
              <Input value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="alex@company.com" />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+1 555-0100" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Company</Label>
              <Input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} placeholder="Acme Corp" />
            </div>
            <div className="space-y-1">
              <Label>Source</Label>
              <Select value={f.source} onValueChange={(v) => setF({ ...f, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                  <SelectItem value="social">Social Media</SelectItem>
                  <SelectItem value="event">Event / Webinar</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Lead Value</Label>
              <Input type="number" min={0} value={f.lead_value} onChange={(e) => setF({ ...f, lead_value: e.target.value })} placeholder="5000" />
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Input value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase().slice(0, 3) })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Expected Close</Label>
              <Input type="date" value={f.expected_close} onChange={(e) => setF({ ...f, expected_close: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Initial Stage</Label>
              <Select value={f.stage_id} onValueChange={(v) => setF({ ...f, stage_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pick stage" /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes / Description</Label>
            <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Context, requirements, qualification notes..." rows={2} />
          </div>

          <Button className="w-full mt-2" disabled={busy} onClick={() => void submit()}>Create lead</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
