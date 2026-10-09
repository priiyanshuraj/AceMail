import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listEmailConfigs,
  saveEmailConfig,
  deleteEmailConfig,
  listBlacklistedDomains,
  addBlacklistedDomain,
  removeBlacklistedDomain,
} from "@/lib/acemail.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const [configs, domains] = await Promise.all([listEmailConfigs(), listBlacklistedDomains()]);
    return { configs, domains };
  },
});

export const Route = createFileRoute("/_authenticated/settings")({
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery),
  head: () => ({
    meta: [
      { title: "Settings — AceMail" },
      { name: "description", content: "SMTP configurations and sending rules." },
      { property: "og:title", content: "Settings — AceMail" },
      { property: "og:description", content: "SMTP configurations and sending rules." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const emptyForm = {
  name: "",
  smtp_host: "",
  smtp_port: 587,
  smtp_username: "",
  smtp_password: "",
  from_email: "",
  from_name: "",
  daily_limit: 50,
  delay_seconds: 60,
  is_default: false,
};

function SettingsPage() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(settingsQuery);
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [domain, setDomain] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["settings"] });

  const handleSave = async () => {
    if (!form) return;
    try {
      await saveEmailConfig({ data: form });
      setForm(null);
      refresh();
      toast.success("Configuration saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check the fields and try again");
    }
  };

  const field = (key: keyof typeof emptyForm, label: string, type = "text", placeholder = "") => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type={type}
        placeholder={placeholder}
        value={String(form?.[key] ?? "")}
        onChange={(e) =>
          setForm({
            ...form!,
            [key]: type === "number" ? Number(e.target.value) : e.target.value,
          })
        }
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Sending accounts and safeguards</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>SMTP configurations</CardTitle>
            <CardDescription>The email accounts your campaigns send from.</CardDescription>
          </div>
          {!form && (
            <Button onClick={() => setForm(emptyForm)}>
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {form && (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="grid gap-4 md:grid-cols-2">
                {field("name", "Name", "text", "Work Gmail")}
                {field("from_email", "From email", "email", "you@company.com")}
                {field("from_name", "From name", "text", "Jane at Acme")}
                {field("smtp_host", "SMTP host", "text", "smtp.gmail.com")}
                {field("smtp_port", "SMTP port", "number")}
                {field("smtp_username", "SMTP username", "text")}
                {field("smtp_password", "SMTP password / app password", "password")}
                {field("daily_limit", "Daily send limit", "number")}
                {field("delay_seconds", "Delay between emails (seconds)", "number")}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
                Use as default
              </label>
              <div className="flex gap-2">
                <Button onClick={handleSave}>Save</Button>
                <Button variant="outline" onClick={() => setForm(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {data.configs.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">
                  {c.name} {c.is_default && <Badge variant="secondary" className="ml-2">default</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.from_email} · {c.smtp_host}:{c.smtp_port} · {c.daily_limit}/day
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  await deleteEmailConfig({ data: { id: c.id } });
                  refresh();
                }}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
          {data.configs.length === 0 && !form && (
            <p className="text-sm text-muted-foreground">No sending accounts yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Blocked domains</CardTitle>
          <CardDescription>Contacts at these domains are skipped when campaigns start.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="competitor.com" />
            <Button
              onClick={async () => {
                if (!domain.trim()) return;
                await addBlacklistedDomain({ data: { domain } });
                setDomain("");
                refresh();
              }}
            >
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.domains.map((d) => (
              <Badge key={d.id} variant="secondary" className="gap-1">
                {d.domain}
                <button
                  onClick={async () => {
                    await removeBlacklistedDomain({ data: { id: d.id } });
                    refresh();
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
