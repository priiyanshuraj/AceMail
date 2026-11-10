import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getCrmSettings, saveCrmSettings } from "@/lib/crm.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, X, Save, Sliders, Globe, Tag, DollarSign, Layers } from "lucide-react";
import { toast } from "sonner";

const settingsQuery = () => queryOptions({ queryKey: ["crm-settings"], queryFn: () => getCrmSettings() });

export const Route = createFileRoute("/_authenticated/crm/settings")({
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery()),
  head: () => ({ meta: [{ title: "CRM Settings | AceMail" }] }),
  component: CrmSettingsPage,
});

function CrmSettingsPage() {
  const qc = useQueryClient();
  const { data: initialSettings } = useSuspenseQuery(settingsQuery());
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm-settings"] });

  const [leadSources, setLeadSources] = useState<string[]>((initialSettings.lead_sources as string[]) ?? []);
  const [lostReasons, setLostReasons] = useState<string[]>((initialSettings.lost_reasons as string[]) ?? []);
  const [territories, setTerritories] = useState<string[]>((initialSettings.territories as string[]) ?? []);
  const [industries, setIndustries] = useState<string[]>((initialSettings.industries as string[]) ?? []);
  const [defaultCurrency, setDefaultCurrency] = useState<string>(initialSettings.default_currency ?? "USD");

  const [newSource, setNewSource] = useState("");
  const [newLostReason, setNewLostReason] = useState("");
  const [newTerritory, setNewTerritory] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await saveCrmSettings({
        data: {
          lead_sources: leadSources,
          lost_reasons: lostReasons,
          territories,
          industries,
          default_currency: defaultCurrency.toUpperCase().slice(0, 3),
        },
      });
      toast.success("CRM settings saved successfully");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const addItem = (list: string[], setList: (v: string[]) => void, val: string, clearVal: () => void) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    if (list.includes(trimmed)) {
      toast.error("Item already exists in list");
      return;
    }
    setList([...list, trimmed]);
    clearVal();
  };

  const removeItem = (list: string[], setList: (v: string[]) => void, index: number) => {
    setList(list.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/crm" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to CRM Overview
          </Link>
          <h1 className="mt-1 text-3xl font-bold">CRM Master Settings</h1>
          <p className="text-sm text-muted-foreground">Configure taxonomy, territories, sources, and currency</p>
        </div>
        <Button onClick={() => void save()} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" /> Save changes
        </Button>
      </div>

      <div className="space-y-6">
        {/* Currency Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" /> Default Currency
            </CardTitle>
            <CardDescription>Primary currency code applied to new deals, quotes, and products</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-xs space-y-1.5">
              <Label>Currency Code (ISO-3)</Label>
              <Input
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value.toUpperCase())}
                placeholder="USD"
                maxLength={3}
                className="font-mono text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Lead Sources Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" /> Lead Sources
            </CardTitle>
            <CardDescription>Origin channels available when logging leads and tracking conversion channels</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {leadSources.map((item, i) => (
                <Badge key={item} variant="secondary" className="gap-1.5 text-xs py-1 px-2.5">
                  {item}
                  <button type="button" onClick={() => removeItem(leadSources, setLeadSources, i)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 max-w-md">
              <Input
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem(leadSources, setLeadSources, newSource, () => setNewSource("")))}
                placeholder="Add source (e.g. Podcast, Webinar)..."
                className="text-xs"
              />
              <Button size="sm" variant="outline" onClick={() => addItem(leadSources, setLeadSources, newSource, () => setNewSource(""))}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lost Reasons Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" /> Deal Lost Reasons
            </CardTitle>
            <CardDescription>Structured feedback recorded whenever a deal is moved to Closed Lost</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {lostReasons.map((item, i) => (
                <Badge key={item} variant="secondary" className="gap-1.5 text-xs py-1 px-2.5">
                  {item}
                  <button type="button" onClick={() => removeItem(lostReasons, setLostReasons, i)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 max-w-md">
              <Input
                value={newLostReason}
                onChange={(e) => setNewLostReason(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem(lostReasons, setLostReasons, newLostReason, () => setNewLostReason("")))}
                placeholder="Add lost reason..."
                className="text-xs"
              />
              <Button size="sm" variant="outline" onClick={() => addItem(lostReasons, setLostReasons, newLostReason, () => setNewLostReason(""))}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Territories Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" /> Sales Territories
            </CardTitle>
            <CardDescription>Geographic regions for routing and segmenting deals and leads</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {territories.map((item, i) => (
                <Badge key={item} variant="secondary" className="gap-1.5 text-xs py-1 px-2.5">
                  {item}
                  <button type="button" onClick={() => removeItem(territories, setTerritories, i)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 max-w-md">
              <Input
                value={newTerritory}
                onChange={(e) => setNewTerritory(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem(territories, setTerritories, newTerritory, () => setNewTerritory("")))}
                placeholder="Add territory (e.g. DACH, UK & Ireland)..."
                className="text-xs"
              />
              <Button size="sm" variant="outline" onClick={() => addItem(territories, setTerritories, newTerritory, () => setNewTerritory(""))}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Industries Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sliders className="h-4 w-4 text-primary" /> Industry Classification
            </CardTitle>
            <CardDescription>Standard industries applied to company organizations and customer accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {industries.map((item, i) => (
                <Badge key={item} variant="secondary" className="gap-1.5 text-xs py-1 px-2.5">
                  {item}
                  <button type="button" onClick={() => removeItem(industries, setIndustries, i)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 max-w-md">
              <Input
                value={newIndustry}
                onChange={(e) => setNewIndustry(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem(industries, setIndustries, newIndustry, () => setNewIndustry("")))}
                placeholder="Add industry (e.g. BioTech, EdTech)..."
                className="text-xs"
              />
              <Button size="sm" variant="outline" onClick={() => addItem(industries, setIndustries, newIndustry, () => setNewIndustry(""))}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
