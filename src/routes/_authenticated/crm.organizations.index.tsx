import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getOrganizations, createOrganization, deleteOrganization } from "@/lib/crm.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Building2, Globe, MapPin, Phone, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

const orgsQuery = () => queryOptions({ queryKey: ["crm-orgs"], queryFn: () => getOrganizations({ data: { q: "" } }) });

export const Route = createFileRoute("/_authenticated/crm/organizations/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(orgsQuery()),
  head: () => ({ meta: [{ title: "Organizations | AceMail CRM" }] }),
  component: OrganizationsPage,
});

function OrganizationsPage() {
  const qc = useQueryClient();
  const { data: orgs } = useSuspenseQuery(orgsQuery());
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm-orgs"] });

  const [search, setSearch] = useState("");

  const filtered = orgs.filter((o) => {
    const text = `${o.name} ${o.industry ?? ""} ${o.city ?? ""} ${o.country ?? ""}`.toLowerCase();
    return !search || text.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/crm" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to CRM Overview
          </Link>
          <h1 className="mt-1 text-3xl font-bold">Organizations</h1>
          <p className="text-sm text-muted-foreground">Manage companies and group contacts under their parent accounts</p>
        </div>
        <NewOrgDialog onDone={refresh} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="h-9 pl-9 text-xs" placeholder="Search organizations..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground">{filtered.length} organizations</p>
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground mb-3">
            <Building2 className="h-6 w-6" />
          </div>
          <h3 className="font-semibold">{search ? "No matching organizations" : "No organizations added yet"}</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {search ? "Try a different search keyword." : "Group your leads and contacts under company accounts."}
          </p>
          {!search && <div className="mt-4"><NewOrgDialog onDone={refresh} /></div>}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((org) => (
            <Card key={org.id} className="relative group">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{org.name}</CardTitle>
                    {org.industry && <p className="text-xs text-muted-foreground">{org.industry}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={async () => {
                      if (!confirm(`Delete ${org.name}?`)) return;
                      try {
                        await deleteOrganization({ data: { id: org.id } });
                        toast.success("Organization deleted");
                        refresh();
                      } catch {
                        toast.error("Could not delete organization");
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                {org.website && (
                  <p className="flex items-center gap-1.5 truncate">
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    <a href={org.website.startsWith("http") ? org.website : `https://${org.website}`} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-foreground">
                      {org.website.replace(/^https?:\/\//, "")}
                    </a>
                  </p>
                )}
                {(org.city || org.country) && (
                  <p className="flex items-center gap-1.5 truncate">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {[org.city, org.country].filter(Boolean).join(", ")}
                  </p>
                )}
                {org.phone && (
                  <p className="flex items-center gap-1.5 truncate">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {org.phone}
                  </p>
                )}
                {org.employee_count && (
                  <p className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    {org.employee_count} employees
                  </p>
                )}
                {org.description && (
                  <p className="pt-1 text-[11px] line-clamp-2">{org.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NewOrgDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: "",
    website: "",
    phone: "",
    address: "",
    city: "",
    country: "",
    industry: "Technology",
    employee_count: "",
    description: "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!f.name.trim()) {
      toast.error("Please enter company name");
      return;
    }
    setBusy(true);
    try {
      await createOrganization({
        data: {
          name: f.name.trim(),
          website: f.website.trim() || null,
          phone: f.phone.trim() || null,
          address: f.address.trim() || null,
          city: f.city.trim() || null,
          country: f.country.trim() || null,
          industry: f.industry || null,
          employee_count: Number(f.employee_count) || null,
          description: f.description.trim() || null,
        },
      });
      toast.success("Organization created");
      setOpen(false);
      setF({ name: "", website: "", phone: "", address: "", city: "", country: "", industry: "Technology", employee_count: "", description: "" });
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
        <Button><Plus className="mr-2 h-4 w-4" /> New organization</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add organization</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label>Company Name *</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Stripe, Inc." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Website</Label>
              <Input value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://example.com" />
            </div>
            <div className="space-y-1">
              <Label>Industry</Label>
              <Select value={f.industry} onValueChange={(v) => setF({ ...f, industry: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Technology">Technology</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Healthcare">Healthcare</SelectItem>
                  <SelectItem value="Retail">Retail</SelectItem>
                  <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="Consulting">Consulting</SelectItem>
                  <SelectItem value="Education">Education</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>City</Label>
              <Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="San Francisco" />
            </div>
            <div className="space-y-1">
              <Label>Country</Label>
              <Input value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} placeholder="USA" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+1 555-0199" />
            </div>
            <div className="space-y-1">
              <Label>Employees</Label>
              <Input type="number" value={f.employee_count} onChange={(e) => setF({ ...f, employee_count: e.target.value })} placeholder="50" />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} />
          </div>

          <Button className="w-full mt-2" disabled={busy || !f.name.trim()} onClick={() => void submit()}>Create organization</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
