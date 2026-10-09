import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listBlacklistedDomains,
  addBlacklistedDomain,
  removeBlacklistedDomain,
} from "@/lib/acemail.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

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
