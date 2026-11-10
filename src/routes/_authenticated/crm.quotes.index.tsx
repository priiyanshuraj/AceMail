import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getQuotes, createQuote, deleteQuote, searchContacts } from "@/lib/crm.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileText, Plus, Search, Trash2, CalendarDays } from "lucide-react";
import { toast } from "sonner";

const quotesQuery = () => queryOptions({ queryKey: ["crm-quotes"], queryFn: () => getQuotes({ data: {} }) });

export const Route = createFileRoute("/_authenticated/crm/quotes/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(quotesQuery()),
  head: () => ({ meta: [{ title: "Quotes | AceMail CRM" }] }),
  component: QuotesPage,
});

const STATUS_BADGES: Record<string, "secondary" | "default" | "outline" | "destructive"> = {
  draft: "secondary",
  sent: "default",
  accepted: "outline",
  rejected: "destructive",
};

function QuotesPage() {
  const qc = useQueryClient();
  const { data: quotes } = useSuspenseQuery(quotesQuery());
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm-quotes"] });

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = quotes.filter((q) => {
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    const contact = q.contacts as { first_name: string; last_name: string; email: string; company: string } | null;
    const text = `${q.title} ${contact?.first_name ?? ""} ${contact?.last_name ?? ""} ${contact?.company ?? ""}`.toLowerCase();
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
          <h1 className="mt-1 text-3xl font-bold">Quotes & Proposals</h1>
          <p className="text-sm text-muted-foreground">Draft and send itemized price quotes to prospective clients</p>
        </div>
        <NewQuoteDialog onDone={refresh} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex flex-wrap gap-1">
          {["all", "draft", "sent", "accepted", "rejected"].map((st) => (
            <Button
              key={st}
              variant={statusFilter === st ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter(st)}
              className="text-xs capitalize"
            >
              {st}
            </Button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="h-9 pl-9 text-xs" placeholder="Search quotes..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quote</TableHead>
              <TableHead>Client / Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Valid Until</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  {search ? "No quotes matched your search." : "No quotes generated yet."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((q) => {
              const contact = q.contacts as { id: string; first_name: string; last_name: string; email: string; company: string } | null;
              const contactName = contact ? (`${contact.first_name} ${contact.last_name}`.trim() || contact.email) : "—";
              return (
                <TableRow key={q.id}>
                  <TableCell>
                    <Link to="/crm/quotes/$quoteId" params={{ quoteId: q.id }} className="font-medium hover:text-primary hover:underline">
                      {q.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">
                    {contact ? (
                      <div>
                        <p className="font-medium">{contactName}</p>
                        <p className="text-muted-foreground">{contact.company}</p>
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGES[q.status] ?? "outline"} className="capitalize text-xs">
                      {q.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {q.valid_until ? (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {new Date(`${q.valid_until}T12:00:00`).toLocaleDateString()}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        if (!confirm(`Delete quote "${q.title}"?`)) return;
                        try {
                          await deleteQuote({ data: { id: q.id } });
                          toast.success("Quote deleted");
                          refresh();
                        } catch {
                          toast.error("Could not delete");
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

function NewQuoteDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", valid_until: "", currency: "USD", notes: "" });
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
      toast.error("Please enter a quote title");
      return;
    }
    setBusy(true);
    try {
      await createQuote({
        data: {
          title: f.title.trim(),
          contact_id: contactId,
          valid_until: f.valid_until || null,
          currency: f.currency || "USD",
          notes: f.notes.trim() || null,
          status: "draft",
        },
      });
      toast.success("Quote created");
      setOpen(false);
      setF({ title: "", valid_until: "", currency: "USD", notes: "" });
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
        <Button><Plus className="mr-2 h-4 w-4" /> New quote</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Price Quote</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label>Quote Title *</Label>
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Acme Q4 Marketing Proposal" />
          </div>

          <div className="space-y-1">
            <Label>Client (optional)</Label>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Valid Until</Label>
              <Input type="date" value={f.valid_until} onChange={(e) => setF({ ...f, valid_until: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Input value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase().slice(0, 3) })} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes & Payment Terms</Label>
            <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Net 30, deliverables, scope..." rows={2} />
          </div>

          <Button className="w-full mt-2" disabled={busy || !f.title.trim()} onClick={() => void submit()}>
            Create Quote
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
