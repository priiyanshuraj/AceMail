import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type CSSProperties } from "react";
import { getPipeline, moveDeal, createDeal, deleteDeal, addStage, renameStage, deleteStage, searchContacts } from "@/lib/crm.functions";
import { stageColor, fmtMoney, STAGE_COLOR_NAMES } from "@/lib/crm-colors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Settings2, Users, Search, Funnel, ArrowUpRight, GripVertical, Trophy, CircleDollarSign, Target, CalendarDays, X } from "lucide-react";
import { toast } from "sonner";

const pipelineQuery = () => queryOptions({ queryKey: ["crm-pipeline"], queryFn: () => getPipeline() });

export const Route = createFileRoute("/_authenticated/crm/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(pipelineQuery()),
  head: () => ({
    meta: [
      { title: "CRM Pipeline | AceMail" },
      { name: "description", content: "Explore your visual sales funnel, manage deals, and track clients from first contact to closed won." },
      { property: "og:title", content: "CRM Pipeline | AceMail" },
      { property: "og:description", content: "Explore your visual sales funnel, manage deals, and track clients from first contact to closed won." },
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
  const [selectedStage, setSelectedStage] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("pipeline");
  const [moving, setMoving] = useState<string | null>(null);
  const allDeals = deals as Deal[];
  const openDeals = allDeals.filter((d) => {
    const s = stages.find((st) => st.id === d.stage_id);
    return s && !s.is_won && !s.is_lost;
  });
  const wonDeals = allDeals.filter((d) => stages.find((st) => st.id === d.stage_id)?.is_won);
  const lostDeals = allDeals.filter((d) => stages.find((st) => st.id === d.stage_id)?.is_lost);
  const currency = allDeals[0]?.currency ?? "USD";
  const valueOf = (items: Deal[]) => items.reduce((sum, d) => sum + Number(d.value), 0);
  const funnelStages = stages.filter((s) => !s.is_lost);
  const activeStage = stages.find((s) => s.id === selectedStage);
  const visibleDeals = allDeals.filter((d) => {
    const text = `${d.title} ${d.contacts?.first_name ?? ""} ${d.contacts?.last_name ?? ""} ${d.contacts?.email ?? ""} ${d.contacts?.company ?? ""}`.toLowerCase();
    return (selectedStage === "all" || d.stage_id === selectedStage) && text.includes(search.toLowerCase());
  }).sort((a, b) => sort === "value" ? Number(b.value) - Number(a.value) : sort === "close" ? (a.expected_close ?? "9999").localeCompare(b.expected_close ?? "9999") : stages.findIndex((s) => s.id === a.stage_id) - stages.findIndex((s) => s.id === b.stage_id));

  const changeStage = async (dealId: string, stageId: string) => {
    const deal = allDeals.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === stageId) return;
    setMoving(dealId);
    try {
      await moveDeal({ data: { id: dealId, stage_id: stageId, position: 0 } });
      await refresh();
      toast.success(`Deal moved to ${stages.find((s) => s.id === stageId)?.name ?? "stage"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not move deal");
    } finally {
      setMoving(null);
    }
  };
  const onDrop = (stageId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const dealId = e.dataTransfer.getData("text/deal-id");
    if (dealId) void changeStage(dealId, stageId);
  };

  return (
    <div className="crm-workspace min-w-0 space-y-6">
      <header className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">CRM / Overview</p>
          <h1 className="mt-1 text-3xl">Sales pipeline</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild><Link to="/crm/clients"><Users /> Client board</Link></Button>
          <StageManager stages={stages} onDone={refresh} />
          <NewDealDialog stages={stages} onDone={refresh} />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-y-5 border-y py-5 lg:grid-cols-4">
        {[
          { label: "Open pipeline", value: fmtMoney(valueOf(openDeals), currency), detail: `${openDeals.length} active deals`, icon: CircleDollarSign },
          { label: "Closed won", value: fmtMoney(valueOf(wonDeals), currency), detail: `${wonDeals.length} won deals`, icon: Trophy },
          { label: "Win rate", value: `${wonDeals.length + lostDeals.length ? Math.round(wonDeals.length / (wonDeals.length + lostDeals.length) * 100) : 0}%`, detail: "Of closed deals", icon: Target },
          { label: "Total deals", value: String(allDeals.length), detail: `${stages.length} pipeline stages`, icon: Users },
        ].map(({ label, value, detail, icon: Icon }) => (
          <div key={label} className="min-w-0 px-3 first:pl-0 lg:border-r lg:last:border-r-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5 shrink-0" />{label}</div>
            <p className="mt-2 break-words text-2xl font-semibold tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </div>
        ))}
      </div>

      <div className="grid min-w-0 gap-7 lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.15fr)]">
        <section className="min-w-0" aria-label="Sales funnel">
          <div className="mb-5 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold"><Funnel className="h-4 w-4 text-primary" /> Sales funnel</h2>
            <Button variant="ghost" size="sm" onClick={() => setSelectedStage("all")} aria-pressed={selectedStage === "all"}>All stages</Button>
          </div>
          <div className="space-y-1.5" role="group" aria-label="Filter deals by funnel stage">
            {funnelStages.map((stage, index) => {
              const items = allDeals.filter((d) => d.stage_id === stage.id);
              const step = 25 / Math.max(funnelStages.length, 1);
              return (
                <Button
                  key={stage.id}
                  variant="ghost"
                  data-color={stage.color}
                  data-selected={selectedStage === stage.id || dragOver === stage.id}
                  className="crm-funnel-segment crm-stage"
                  style={{ "--funnel-top": `${index * step}%`, "--funnel-bottom": `${(index + 1) * step}%` } as CSSProperties}
                  aria-label={`Filter ${stage.name}, ${items.length} deals`}
                  aria-pressed={selectedStage === stage.id}
                  onClick={() => setSelectedStage(selectedStage === stage.id ? "all" : stage.id)}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(stage.id); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => onDrop(stage.id, e)}
                >
                  <span className="crm-funnel-content">
                    <span className="flex min-w-0 items-center justify-center gap-2"><span className="crm-stage-dot h-2 w-2 shrink-0 rounded-full" /><span className="min-w-0 whitespace-normal break-words text-sm font-semibold">{stage.name}</span><span className="font-mono text-sm">{items.length}</span></span>
                    <span className="mt-1 block text-xs text-muted-foreground">{fmtMoney(valueOf(items), currency)}</span>
                  </span>
                </Button>
              );
            })}
          </div>
          <div className="mt-5 space-y-2 border-t pt-4">
            {stages.filter((s) => s.is_lost).map((stage) => (
              <Button key={stage.id} variant="ghost" data-color={stage.color} className="crm-stage w-full justify-between" aria-pressed={selectedStage === stage.id} onClick={() => setSelectedStage(selectedStage === stage.id ? "all" : stage.id)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(stage.id, e)}>
                <span className="flex items-center gap-2"><span className="crm-stage-dot h-2 w-2 rounded-full" />{stage.name}</span>
                <span className="text-muted-foreground">{allDeals.filter((d) => d.stage_id === stage.id).length} · {fmtMoney(valueOf(allDeals.filter((d) => d.stage_id === stage.id)), currency)}</span>
              </Button>
            ))}
          </div>
        </section>

        <section className="min-w-0 lg:border-l lg:pl-7" aria-label="Deal workspace">
          <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2"><h2 className="truncate text-base font-semibold">{activeStage?.name ?? "All deals"}</h2><span className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums">{visibleDeals.length}</span></div>
            {selectedStage !== "all" && <Button variant="ghost" size="icon" aria-label="Clear stage filter" onClick={() => setSelectedStage("all")}><X /></Button>}
          </div>
          <div className="mb-4 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
            <div className="relative min-w-0"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="h-10 pl-9" aria-label="Search deals" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search deals or clients" /></div>
            <Select value={sort} onValueChange={setSort}><SelectTrigger className="h-10 w-28" aria-label="Sort deals"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pipeline">Stage</SelectItem><SelectItem value="value">Value</SelectItem><SelectItem value="close">Close date</SelectItem></SelectContent></Select>
          </div>
          {visibleDeals.length > 0 ? <div className="divide-y border-y">{visibleDeals.map((deal) => <DealCard key={deal.id} deal={deal} stages={stages} moving={moving === deal.id} onMove={(id) => void changeStage(deal.id, id)} onChanged={refresh} />)}</div> : (
            <div className="flex min-h-64 flex-col items-center justify-center border-y px-4 py-10 text-center">
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-accent text-primary"><Funnel className="h-5 w-5" /></div>
              <h3 className="text-base font-semibold">{search ? "No matching deals" : activeStage ? `No deals in ${activeStage.name}` : "Your next opportunity starts here"}</h3>
              <p className="mt-2 max-w-64 text-sm text-muted-foreground">{search ? "Try a different name or company." : "Add a deal to bring your pipeline to life."}</p>
              <div className="mt-5">{search ? <Button variant="outline" onClick={() => setSearch("")}>Clear search</Button> : <NewDealDialog stages={stages} onDone={refresh} />}</div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DealCard({ deal, stages, moving, onMove, onChanged }: { deal: Deal; stages: { id: string; name: string }[]; moving: boolean; onMove: (stageId: string) => void; onChanged: () => void }) {
  const c = deal.contacts;
  const name = c ? (`${c.first_name} ${c.last_name}`.trim() || c.email) : "Unknown";
  return (
    <div draggable onDragStart={(e) => { e.dataTransfer.setData("text/deal-id", deal.id); e.dataTransfer.effectAllowed = "move"; }} className="group grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 py-4">
      <GripVertical className="mt-1 h-4 w-4 cursor-grab text-muted-foreground/50" />
      <div className="min-w-0 space-y-2">
        <Link to="/crm/clients/$contactId" params={{ contactId: deal.contact_id }} className="flex min-w-0 items-center gap-2 text-sm font-semibold hover:text-primary"><span className="truncate">{name}</span><ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /></Link>
        <p className="truncate text-xs text-muted-foreground">{[c?.company, deal.title || c?.email].filter(Boolean).join(" · ")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium tabular-nums">{fmtMoney(Number(deal.value), deal.currency)}</span>
          {deal.expected_close && <span className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3 w-3" />{new Date(`${deal.expected_close}T12:00:00`).toLocaleDateString()}</span>}
        </div>
        <Select value={deal.stage_id} onValueChange={onMove} disabled={moving}><SelectTrigger className="h-8 w-full max-w-44 text-xs" aria-label={`Stage for ${deal.title || name}`}><SelectValue /></SelectTrigger><SelectContent>{stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label={`Delete deal ${deal.title || name}`} onClick={async () => { try { await deleteDeal({ data: { id: deal.id } }); onChanged(); } catch (err) { toast.error(err instanceof Error ? err.message : "Could not delete"); } }}><Trash2 className="h-3.5 w-3.5" /></Button>
    </div>
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
