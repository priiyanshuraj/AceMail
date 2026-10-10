import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listBlacklistedDomains,
  addBlacklistedDomain,
  removeBlacklistedDomain,
  getSignature,
  saveSignature,
} from "@/lib/acemail.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { toast } from "sonner";
import { inboxDocument, signatureHtml } from "@/lib/email-content";

function SignatureCard() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["signature"], queryFn: () => getSignature() });
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"plain" | "html">("plain");
  useEffect(() => {
    if (data !== undefined) {
      setValue(data);
      if (/<\/?[a-z][a-z0-9]*\b[^>]*>/i.test(data)) setMode("html");
    }
  }, [data]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Email signature</CardTitle>
        <CardDescription>
          Added below the body of templates where "Attach signature" is ticked. Variables like {"{{first_name}}"} work here too.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={mode === "plain" ? "default" : "outline"} onClick={() => setMode("plain")}>
            Plain text
          </Button>
          <Button type="button" size="sm" variant={mode === "html" ? "default" : "outline"} onClick={() => setMode("html")}>
            HTML
          </Button>
        </div>
        <Textarea
          rows={6}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={mode === "html" ? '<p>Best,<br /><strong>Raj</strong><br />Founder, AceMail</p>' : "Best,\nRaj\nFounder, AceMail"}
          className={mode === "html" ? "font-mono text-xs" : undefined}
        />
        {value.trim() && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Preview</p>
            <iframe
              title="Signature preview"
              sandbox=""
              srcDoc={inboxDocument(signatureHtml(value))}
              className="h-40 w-full rounded-md border bg-white"
            />
          </div>
        )}
        <Button
          disabled={saving || value === (data ?? "")}
          onClick={async () => {
            setSaving(true);
            try {
              await saveSignature({ data: { signature: value } });
              await queryClient.invalidateQueries({ queryKey: ["signature"] });
              toast.success("Signature saved");
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : "Save signature"}
        </Button>
      </CardContent>
    </Card>
  );
}

const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const domains = await listBlacklistedDomains();
    return { domains };
  },
});

export const Route = createFileRoute("/_authenticated/settings")({
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery),
  head: () => ({
    meta: [
      { title: "Settings — AceMail" },
      { name: "description", content: "Sending safeguards and blocked domains." },
      { property: "og:title", content: "Settings — AceMail" },
      { property: "og:description", content: "Sending safeguards and blocked domains." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(settingsQuery);
  const [domain, setDomain] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["settings"] });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Sending accounts and safeguards</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sending mailboxes</CardTitle>
          <CardDescription>Connect Gmail, set limits and warmup on the Mailboxes page.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline"><Link to="/mailboxes">Manage mailboxes</Link></Button>
        </CardContent>
      </Card>

      <SignatureCard />

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
