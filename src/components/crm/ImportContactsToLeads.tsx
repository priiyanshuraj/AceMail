import { useEffect, useState } from "react";
import { importLeadsFromContacts, searchContacts } from "@/lib/crm.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Search, UserPlus, Zap } from "lucide-react";
import { toast } from "sonner";

export type ContactPick = { id: string; email: string; first_name: string | null; last_name: string | null; company: string | null; phone?: string | null };

function useContactSearch(open: boolean) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ContactPick[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      searchContacts({ data: { q } })
        .then((r) => alive && setRows(r as ContactPick[]))
        .catch(() => alive && setRows([]))
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q, open]);
  return { q, setQ, rows, loading };
}

const nameOf = (c: ContactPick) => `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email;

/** Bulk-import contacts as leads (search + multi-select). */
export function ImportContactsDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const { q, setQ, rows, loading } = useContactSearch(open);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOn = rows.length > 0 && rows.every((r) => sel.has(r.id));

  const submit = async () => {
    setBusy(true);
    try {
      const r = await importLeadsFromContacts({ data: { contact_ids: [...sel] } });
      toast.success(`${r.created} lead${r.created === 1 ? "" : "s"} added${r.skipped ? `, ${r.skipped} already in leads` : ""}`);
      setSel(new Set()); setOpen(false); onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not import");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><UserPlus className="mr-2 h-4 w-4" /> Import from contacts</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Import leads from contacts</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, email or company" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            <Checkbox checked={allOn} onCheckedChange={() => setSel((s) => { const n = new Set(s); rows.forEach((r) => (allOn ? n.delete(r.id) : n.add(r.id))); return n; })} />
            Select all shown
          </label>
          <span>{sel.size} selected</span>
        </div>
        <div className="max-h-80 divide-y overflow-y-auto rounded-md border">
          {loading && <div className="flex justify-center p-6"><Loader2 className="h-4 w-4 animate-spin" /></div>}
          {!loading && rows.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No contacts found.</p>}
          {!loading && rows.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
              <Checkbox checked={sel.has(c.id)} onCheckedChange={() => toggle(c.id)} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{nameOf(c)}</p>
                <p className="truncate text-xs text-muted-foreground">{[c.email, c.company].filter(Boolean).join(" · ")}</p>
              </div>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Contacts that are already leads are skipped automatically.</p>
        <Button disabled={!sel.size || busy} onClick={() => void submit()}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Add {sel.size || ""} as leads
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** Compact picker to prefill a form from an existing contact. */
export function ContactPrefill({ onPick }: { onPick: (c: ContactPick) => void }) {
  const [open, setOpen] = useState(false);
  const { q, setQ, rows, loading } = useContactSearch(open);
  return (
    <div className="rounded-md border border-dashed p-2">
      {!open ? (
        <Button type="button" variant="ghost" size="sm" className="w-full text-xs" onClick={() => setOpen(true)}>
          <UserPlus className="mr-2 h-3.5 w-3.5" /> Fill in from an existing contact
        </Button>
      ) : (
        <div className="space-y-2">
          <Input autoFocus className="h-8 text-xs" placeholder="Search contacts…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="max-h-40 overflow-y-auto">
            {loading && <Loader2 className="mx-auto my-2 h-4 w-4 animate-spin" />}
            {!loading && rows.map((c) => (
              <button key={c.id} type="button" className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-muted" onClick={() => { onPick(c); setOpen(false); }}>
                <span className="font-medium">{nameOf(c)}</span> <span className="text-muted-foreground">{c.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Bulk action for the Contacts page. */
export function AddContactsToLeadsButton({ ids }: { ids: string[] }) {
  const [busy, setBusy] = useState(false);
  if (!ids.length) return null;
  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        const r = await importLeadsFromContacts({ data: { contact_ids: ids } });
        toast.success(`${r.created} added to CRM leads${r.skipped ? `, ${r.skipped} already there` : ""}`);
      } catch (e) { toast.error(e instanceof Error ? e.message : "Could not add to leads"); }
      finally { setBusy(false); }
    }}>
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}Add to leads ({ids.length})
    </Button>
  );
}
