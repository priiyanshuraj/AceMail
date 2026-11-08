import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getPipeline, moveDeal, createDeal, deleteDeal, addStage, renameStage, deleteStage, searchContacts } from "@/lib/crm.functions";
import { stageColor, fmtMoney, STAGE_COLOR_NAMES } from "@/lib/crm-colors";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Settings2, Users } from "lucide-react";
import { toast } from "sonner";

const pipelineQuery = () => queryOptions({ queryKey: ["crm-pipeline"], queryFn: () => getPipeline() });

export const Route = createFileRoute("/_authenticated/crm/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(pipelineQuery()),
  head: () => ({
    meta: [
      { title: "CRM Pipeline | AceMail" },
      { name: "description", content: "Interactive deal pipeline: drag leads through your sales funnel from first contact to won." },
      { property: "og:title", content: "CRM Pipeline | AceMail" },
      { property: "og:description", content: "Interactive deal pipeline: drag leads through your sales funnel from first contact to won." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CrmPipelinePage,
});

type Deal = {
  id: string;
  stage_id: string;
  title: string;
  value: number;
  currency: string;
  expected_close: string | null;
  contact_id: string;
  contacts: { email: string; first_name: string; last_name: string; company: string } | null;
};

function CrmPipelinePage() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(pipelineQuery());
  const { stages, deals } = data;
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm-pipeline"] });
  const [dragOver, setDragOver] = useState<string | null>(null);

  const openDeals = (deals as Deal[]).filter((d) => {
    const s = stages.find((st) => st.id === d.stage_id);
    return s && !s.is_won && !s.is_lost;
  });
  const wonDeals = (deals as Deal[]).filter((d) => stages.find((st) => st.id === d.stage_id)?.is_won);
  const openValue = openDeals.reduce((s, d) => s + Number(d.value), 0);
  const wonValue = wonDeals.reduce((s, d) => s + Number(d.value), 0);
  const currency = (deals[0] as Deal | undefined)?.currency ?? "USD";

  const onDrop = async (stageId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const dealId = e.dataTransfer.getData("text/deal-id");
    if (!dealId) return;
    const deal = (deals as Deal[]).find((d) => d.id === dealId);
    if (!deal || deal.stage_id === stageId) return;
    try {
      await moveDeal({ data: { id: dealId, stage_id: stageId, position: 0 } });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not move deal");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            {openDeals.length} open deals worth {fmtMoney(openValue, currency)} · {wonDeals.length} won worth {fmtMoney(wonValue, currency)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/crm/clients"><Users className="mr-2 h-4 w-4" /> Client board</Link>
          </Button>
          <StageManager stages={stages} onDone={refresh} />
          <NewDealDialog stages={stages} onDone={refresh} />
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageDeals = (deals as Deal[]).filter((d) => d.stage_id === stage.id);
          const total = stageDeals.reduce((s, d) => s + Number(d.value), 0);
          const c = stageColor(stage.color);
          return (
            <div
              key={stage.id}
              className={`flex w-64 shrink-0 flex-col rounded-xl border border-t-4 glass ${c.border} ${dragOver === stage.id ? "ring-2 ring-primary" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(stage.id);
              }}
              onDragLeave={() => setDragOver((cur) => (cur === stage.id ? null : cur))}
              onDrop={(e) => void onDrop(stage.id, e)}
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{stage.name}</span>
                <span className="text-xs text-muted-foreground">{stageDeals.length}</span>
              </div>
              <p className="px-3 pb-2 text-xs text-muted-foreground">{fmtMoney(total, currency)}</p>
              <div className="flex-1 space-y-2 px-2 pb-2">
                {stageDeals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} onChanged={refresh} />
                ))}
                {stageDeals.length === 0 && (
                  <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">Drop deals here</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DealCard({ deal, onChanged }: { deal: Deal; onChanged: () => void }) {
  const c = deal.contacts;
  const name = c ? (`${c.first_name} ${c.last_name}`.trim() || c.email) : "Unknown";
  return (
    <Card
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/deal-id", deal.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="cursor-grab active:cursor-grabbing"
    >
      <CardContent className="space-y-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <Link
            to="/crm/clients/$contactId"
            params={{ contactId: deal.contact_id }}
            className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {name}
          </Link>
          <button
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label="Delete deal"
            onClick={async () => {
              try {
                await deleteDeal({ data: { id: deal.id } });
                onChanged();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not delete");
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {c?.company && <p className="truncate text-xs text-muted-foreground">{c.company}</p>}
        {deal.title && <p className="truncate text-xs text-muted-foreground">{deal.title}</p>}
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-sm font-semibold">{Number(deal.value) > 0 ? fmtMoney(Number(deal.value), deal.currency) : "—"}</span>
          {deal.expected_close && <span className="text-xs text-muted-foreground">{new Date(deal.expected_close).toLocaleDateString()}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function NewDealDialog({ stages, onDone }: { stages: { id: string; name: string }[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; email: string; first_name: string; last_name: string; company: string }[]>([]);
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactLabel, setContactLabel] = useState("");
  const [f, setF] = useState({ title: "", value: "", currency: "USD", expected_close: "", stage_id: "" });
  const [busy, setBusy] = useState(false);

  const search = async (term: string) => {
    setQ(term);
    try {
      setResults(await searchContacts({ data: { q: term } }));
    } catch {
      /* ignore search errors */
    }
  };

  const submit = async () => {
    if (!contactId) {
      toast.error("Pick a contact first");
      return;
    }
    setBusy(true);
    try {
      await createDeal({
        data: {
          contact_id: contactId,
          title: f.title,
          value: Number(f.value) || 0,
          currency: f.currency || "USD",
          expected_close: f.expected_close || null,
          ...(f.stage_id ? { stage_id: f.stage_id } : {}),
        },
      });
      toast.success("Deal added to the pipeline");
      setOpen(false);
      setContactId(null);
      setContactLabel("");
      setQ("");
      setResults([]);
      setF({ title: "", value: "", currency: "USD", expected_close: "", stage_id: "" });
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create deal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> New deal</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a deal</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Contact</Label>
            {contactId ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span className="truncate">{contactLabel}</span>
                <Button variant="ghost" size="sm" onClick={() => setContactId(null)}>Change</Button>
              </div>
            ) : (
              <>
                <Input value={q} onChange={(e) => void search(e.target.value)} placeholder="Search contacts by name, email or company" />
                <div className="max-h-40 divide-y overflow-y-auto rounded-md border">
                  {results.map((r) => (
                    <button
                      key={r.id}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        setContactId(r.id);
                        setContactLabel(`${`${r.first_name} ${r.last_name}`.trim() || r.email}${r.company ? ` · ${r.company}` : ""}`);
                      }}
                    >
                      {`${r.first_name} ${r.last_name}`.trim() || r.email}
                      <span className="text-muted-foreground">{r.company ? ` · ${r.company}` : ""} · {r.email}</span>
                    </button>
                  ))}
                  {results.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No matches.</p>}
                </div>
              </>
            )}
          </div>
          <div className="space-y-1">
            <Label>Deal name (optional)</Label>
            <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Annual plan" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Value</Label>
              <Input type="number" min={0} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Input value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase().slice(0, 3) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Expected close</Label>
              <Input type="date" value={f.expected_close} onChange={(e) => setF({ ...f, expected_close: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Stage</Label>
              <Select value={f.stage_id} onValueChange={(v) => setF({ ...f, stage_id: v })}>
                <SelectTrigger><SelectValue placeholder="First stage" /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full" disabled={busy} onClick={() => void submit()}>Add deal</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StageManager({ stages, onDone }: { stages: { id: string; name: string; color: string; is_won: boolean; is_lost: boolean }[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("slate");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Settings2 className="mr-2 h-4 w-4" /> Stages</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Pipeline stages</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {stages.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <span className={`h-3 w-3 shrink-0 rounded-full ${stageColor(s.color).dot}`} />
              <Input
                defaultValue={s.name}
                className="h-8"
                onBlur={async (e) => {
                  const name = e.target.value.trim();
                  if (name && name !== s.name) {
                    try {
                      await renameStage({ data: { id: s.id, name, color: s.color } });
                      onDone();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not rename");
                    }
                  }
                }}
              />
              <Select value={s.color} onValueChange={async (color) => {
                try {
                  await renameStage({ data: { id: s.id, name: s.name, color } });
                  onDone();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not update");
                }
              }}>
                <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGE_COLOR_NAMES.map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${stageColor(c).dot}`} />{c}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!s.is_won && !s.is_lost && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label={`Delete stage ${s.name}`}
                  onClick={async () => {
                    try {
                      await deleteStage({ data: { id: s.id } });
                      onDone();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not delete stage");
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <div className="flex gap-2 border-t pt-3">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New stage name" className="h-8" />
            <Select value={newColor} onValueChange={setNewColor}>
              <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGE_COLOR_NAMES.map((c) => (
                  <SelectItem key={c} value={c}>
                    <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${stageColor(c).dot}`} />{c}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8"
              disabled={!newName.trim()}
              onClick={async () => {
                try {
                  await addStage({ data: { name: newName.trim(), color: newColor } });
                  setNewName("");
                  onDone();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not add stage");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
