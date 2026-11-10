import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getQuote, updateQuote, deleteQuote, addQuoteItem, deleteQuoteItem, getProducts } from "@/lib/crm.functions";
import { fmtMoney } from "@/lib/crm-colors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Printer, Check, User } from "lucide-react";
import { toast } from "sonner";

const quoteQuery = (id: string) => queryOptions({ queryKey: ["crm-quote", id], queryFn: () => getQuote({ data: { id } }) });
const productsQuery = () => queryOptions({ queryKey: ["crm-products-picker"], queryFn: () => getProducts({ data: { q: "" } }) });

export const Route = createFileRoute("/_authenticated/crm/quotes/$quoteId")({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(quoteQuery(params.quoteId)),
      context.queryClient.ensureQueryData(productsQuery()),
    ]);
  },
  head: () => ({ meta: [{ title: "Quote Builder | AceMail CRM" }] }),
  component: QuoteBuilderPage,
});

function QuoteBuilderPage() {
  const { quoteId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: quoteData } = useSuspenseQuery(quoteQuery(quoteId));
  const { data: products } = useSuspenseQuery(productsQuery());
  const { quote, items } = quoteData;
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm-quote", quoteId] });

  const [title, setTitle] = useState(quote.title);
  const [status, setStatus] = useState(quote.status);
  const [notes, setNotes] = useState(quote.notes ?? "");
  const [validUntil, setValidUntil] = useState(quote.valid_until ?? "");

  const contact = quote.contacts as { id: string; first_name: string; last_name: string; email: string; company: string } | null;
  const contactName = contact ? (`${contact.first_name} ${contact.last_name}`.trim() || contact.email) : null;

  const subtotal = items.reduce((sum, item) => sum + Number(item.qty) * Number(item.unit_price), 0);
  const discountTotal = items.reduce((sum, item) => {
    const raw = Number(item.qty) * Number(item.unit_price);
    return sum + (raw * (Number(item.discount_pct) / 100));
  }, 0);
  const total = subtotal - discountTotal;

  const saveMeta = async () => {
    try {
      await updateQuote({
        data: {
          id: quote.id,
          title,
          status: status as any,
          notes: notes || null,
          valid_until: validUntil || null,
        },
      });
      toast.success("Quote updated");
      refresh();
    } catch {
      toast.error("Could not update quote");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/crm/quotes" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to Quotes
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-2xl font-bold">{quote.title}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={status}
            onValueChange={async (v) => {
              setStatus(v);
              try {
                await updateQuote({ data: { id: quote.id, status: v as any } });
                toast.success(`Quote marked as ${v}`);
                refresh();
              } catch {
                toast.error("Could not update status");
              }
            }}
          >
            <SelectTrigger className="h-9 w-32 text-xs capitalize"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-3.5 w-3.5" /> Print / PDF
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            onClick={async () => {
              if (!confirm("Delete this quote?")) return;
              try {
                await deleteQuote({ data: { id: quote.id } });
                toast.success("Quote deleted");
                navigate({ to: "/crm/quotes" });
              } catch {
                toast.error("Could not delete");
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Items & Details */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Line Items</CardTitle>
              <AddItemDialog quoteId={quote.id} products={products} onDone={refresh} />
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-20 text-right">Qty</TableHead>
                    <TableHead className="w-28 text-right">Unit Price</TableHead>
                    <TableHead className="w-24 text-right">Disc %</TableHead>
                    <TableHead className="w-28 text-right">Subtotal</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                        No items added yet. Click &quot;Add line item&quot; above.
                      </TableCell>
                    </TableRow>
                  )}
                  {items.map((item) => {
                    const lineSubtotal = Number(item.qty) * Number(item.unit_price) * (1 - Number(item.discount_pct) / 100);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="font-medium text-xs">{item.name}</p>
                          {item.description && <p className="text-[11px] text-muted-foreground">{item.description}</p>}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{item.qty}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{fmtMoney(Number(item.unit_price), quote.currency)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums">{Number(item.discount_pct) > 0 ? `${item.discount_pct}%` : "—"}</TableCell>
                        <TableCell className="text-right text-xs font-semibold tabular-nums">{fmtMoney(lineSubtotal, quote.currency)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={async () => {
                              try {
                                await deleteQuoteItem({ data: { id: item.id } });
                                refresh();
                              } catch {
                                toast.error("Could not remove item");
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Terms & Notes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={saveMeta}
                placeholder="Payment terms, expiration conditions, scope of work..."
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Summary & Client */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Quote Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium tabular-nums">{fmtMoney(subtotal, quote.currency)}</span>
              </div>
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Discount Savings</span>
                <span className="font-medium text-green-600 dark:text-green-400 tabular-nums">
                  -{fmtMoney(discountTotal, quote.currency)}
                </span>
              </div>
              <div className="flex justify-between py-2 text-sm font-bold">
                <span>Total</span>
                <span className="tabular-nums">{fmtMoney(total, quote.currency)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Client Details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              {contact ? (
                <>
                  <p className="font-semibold text-sm">{contactName}</p>
                  {contact.company && <p className="text-muted-foreground">{contact.company}</p>}
                  <p className="text-muted-foreground">{contact.email}</p>
                  <Button variant="outline" size="sm" asChild className="mt-2 w-full">
                    <Link to="/crm/clients/$contactId" params={{ contactId: contact.id }}>
                      View Client Profile
                    </Link>
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground">No contact linked to this quote.</p>
              )}

              <div className="pt-3 border-t space-y-1">
                <Label className="text-[11px]">Valid Until</Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  onBlur={saveMeta}
                  className="h-8 text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AddItemDialog({ quoteId, products, onDone }: { quoteId: string; products: any[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: "",
    description: "",
    qty: "1",
    unit_price: "0",
    discount_pct: "0",
    product_id: null as string | null,
  });
  const [busy, setBusy] = useState(false);

  const onSelectProduct = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setF({
      ...f,
      product_id: p.id,
      name: p.name,
      description: p.description ?? "",
      unit_price: String(p.price),
    });
  };

  const submit = async () => {
    if (!f.name.trim()) {
      toast.error("Please enter item name");
      return;
    }
    setBusy(true);
    try {
      await addQuoteItem({
        data: {
          quote_id: quoteId,
          product_id: f.product_id,
          name: f.name.trim(),
          description: f.description.trim() || null,
          qty: Number(f.qty) || 1,
          unit_price: Number(f.unit_price) || 0,
          discount_pct: Number(f.discount_pct) || 0,
        },
      });
      toast.success("Item added");
      setOpen(false);
      setF({ name: "", description: "", qty: "1", unit_price: "0", discount_pct: "0", product_id: null });
      onDone();
    } catch {
      toast.error("Could not add item");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-3.5 w-3.5" /> Add line item</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Item to Quote</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          {products.length > 0 && (
            <div className="space-y-1">
              <Label>Select from Catalog (optional)</Label>
              <Select onValueChange={onSelectProduct}>
                <SelectTrigger><SelectValue placeholder="Pick a product..." /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({fmtMoney(Number(p.price), p.currency)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>Item Name *</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Implementation fee" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Unit Price</Label>
              <Input type="number" min={0} value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Discount %</Label>
              <Input type="number" min={0} max={100} value={f.discount_pct} onChange={(e) => setF({ ...f, discount_pct: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Description (optional)</Label>
            <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Deliverable details" />
          </div>

          <Button className="w-full mt-2" disabled={busy || !f.name.trim()} onClick={() => void submit()}>
            Add Line Item
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
