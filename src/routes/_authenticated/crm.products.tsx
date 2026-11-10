import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getProducts, createProduct, updateProduct, deleteProduct } from "@/lib/crm.functions";
import { fmtMoney } from "@/lib/crm-colors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Package, Plus, Search, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";

const productsQuery = () => queryOptions({ queryKey: ["crm-products"], queryFn: () => getProducts({ data: { q: "" } }) });

export const Route = createFileRoute("/_authenticated/crm/products")({
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQuery()),
  head: () => ({ meta: [{ title: "Product Catalog | AceMail CRM" }] }),
  component: ProductsPage,
});

type Product = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  price: number;
  currency: string;
  type: string;
};

function ProductsPage() {
  const qc = useQueryClient();
  const { data: products } = useSuspenseQuery(productsQuery());
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm-products"] });

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);

  const filtered = (products as Product[]).filter((p) => {
    const text = `${p.name} ${p.sku ?? ""} ${p.description ?? ""}`.toLowerCase();
    return !search || text.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/crm" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to CRM Overview
          </Link>
          <h1 className="mt-1 text-3xl font-bold">Products & Services</h1>
          <p className="text-sm text-muted-foreground">Manage your price catalog to quickly add line items to deals and quotes</p>
        </div>
        <ProductDialog onDone={refresh} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="h-9 pl-9 text-xs" placeholder="Search by name or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground">{filtered.length} products</p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product / Service</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-muted">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                  {search ? "No products matched your search." : "Your catalog is empty."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <p className="font-medium text-sm">{p.name}</p>
                  {p.description && <p className="text-xs text-muted-foreground truncate max-w-sm">{p.description}</p>}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{p.sku ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize text-xs">{p.type}</Badge>
                </TableCell>
                <TableCell className="text-right font-medium text-sm tabular-nums">
                  {fmtMoney(Number(p.price), p.currency)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setEditing(p)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        if (!confirm(`Delete ${p.name}?`)) return;
                        try {
                          await deleteProduct({ data: { id: p.id } });
                          toast.success("Product deleted");
                          refresh();
                        } catch {
                          toast.error("Could not delete product");
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <ProductDialog
          product={editing}
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          onDone={() => { setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

function ProductDialog({ product, open: controlledOpen, onOpenChange, onDone }: { product?: Product; open?: boolean; onOpenChange?: (open: boolean) => void; onDone: () => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [f, setF] = useState({
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    price: product?.price ? String(product.price) : "",
    currency: product?.currency ?? "USD",
    type: product?.type ?? "product",
    description: product?.description ?? "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!f.name.trim()) {
      toast.error("Please enter a product name");
      return;
    }
    setBusy(true);
    try {
      if (product) {
        await updateProduct({
          data: {
            id: product.id,
            name: f.name.trim(),
            sku: f.sku.trim() || null,
            price: Number(f.price) || 0,
            currency: f.currency,
            type: f.type as "product" | "service",
            description: f.description.trim() || null,
          },
        });
        toast.success("Product updated");
      } else {
        await createProduct({
          data: {
            name: f.name.trim(),
            sku: f.sku.trim() || null,
            price: Number(f.price) || 0,
            currency: f.currency,
            type: f.type as "product" | "service",
            description: f.description.trim() || null,
          },
        });
        toast.success("Product created");
      }
      setOpen(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error saving product");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!product && (
        <DialogTrigger asChild>
          <Button><Plus className="mr-2 h-4 w-4" /> Add product</Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader><DialogTitle>{product ? "Edit Product" : "New Product / Service"}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Annual Cloud License" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>SKU / Code</Label>
              <Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} placeholder="SKU-1001" />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Physical / Digital Product</SelectItem>
                  <SelectItem value="service">Service / Hourly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Price</Label>
              <Input type="number" min={0} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="99.00" />
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Input value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase().slice(0, 3) })} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} />
          </div>

          <Button className="w-full mt-2" disabled={busy || !f.name.trim()} onClick={() => void submit()}>
            {product ? "Update Product" : "Save Product"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
