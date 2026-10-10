import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listOutbox } from "@/lib/mailbox.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, RefreshCw } from "lucide-react";

const outboxQuery = queryOptions({ queryKey: ["outbox"], queryFn: () => listOutbox() });

export const Route = createFileRoute("/_authenticated/outbox")({
  loader: ({ context }) => context.queryClient.ensureQueryData(outboxQuery),
  head: () => ({
    meta: [
      { title: "Outbox — AceMail" },
      { name: "description", content: "Every queued and sent campaign email across your mailboxes." },
      { property: "og:title", content: "Outbox — AceMail" },
      { property: "og:description", content: "Every queued and sent campaign email across your mailboxes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OutboxPage,
});

type Filter = "all" | "queued" | "sent" | "opened" | "replied" | "failed";

const STATUS_STYLE: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  sent: "bg-primary/10 text-primary",
  opened: "bg-amber/15 text-amber",
  replied: "bg-green-700/15 text-green-700",
  failed: "bg-destructive/10 text-destructive",
};

function OutboxPage() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(outboxQuery);
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);

  const rows = filter === "all" ? data : data.filter((l) => l.status === filter);
  const count = (s: Filter) => (s === "all" ? data.length : data.filter((l) => l.status === s).length);
  const refresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["outbox"] });
    setRefreshing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Outbox</h1>
          <p className="text-sm text-muted-foreground">
            Everything your campaigns have queued or sent, across every mailbox — with open and reply status.
          </p>
        </div>
        <Button variant="outline" disabled={refreshing} onClick={refresh}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "queued", "sent", "opened", "replied", "failed"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)} ({count(f)})
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="divide-y p-0">
          {rows.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nothing here yet. Start a campaign and its emails will appear in this list.
            </p>
          )}
          {rows.map((l) => {
            const contact = l.contacts as { email: string; first_name: string; last_name: string; company: string } | null;
            const campaign = l.campaigns as { name: string } | null;
            const step = l.campaign_steps as { step_order: number; email_templates: { subject: string } | null } | null;
            const name = contact ? `${contact.first_name} ${contact.last_name}`.trim() : "";
            const when = l.sent_at ?? l.scheduled_at;
            return (
              <div key={l.id} className="flex items-start gap-4 p-4 hover:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{name || contact?.email || l.direct_to || "Unknown contact"}</span>
                    {name && contact && <span className="text-xs text-muted-foreground">{contact.email}</span>}
                    {contact?.company && <span className="text-xs text-muted-foreground">· {contact.company}</span>}
                    {campaign && <Badge variant="outline">{campaign.name}</Badge>}
                    {step && <Badge variant="outline">Step {step.step_order}</Badge>}
                    {l.direct_to && <Badge variant="outline">Direct email</Badge>}
                  </div>
                  <p className="truncate text-sm">{step?.email_templates?.subject || l.direct_subject || "(no subject)"}</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {l.mailbox_email && <span>from {l.mailbox_email}</span>}
                    <span>{l.sent_at ? "sent" : "scheduled"} {new Date(when).toLocaleString()}</span>
                    {l.opened_at && <span>opened {new Date(l.opened_at).toLocaleString()}</span>}
                    {l.replied_at && <span>replied {new Date(l.replied_at).toLocaleString()}</span>}
                  </div>
                  {l.status === "failed" && l.error && (
                    <p className="mt-1 truncate text-xs text-destructive">{l.error}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[l.status] ?? STATUS_STYLE["queued"]}`}>
                    {l.status}
                  </span>
                  {l.gmail_thread_id && (
                    <a
                      href={`https://mail.google.com/mail/u/${l.mailbox_email ?? 0}/#all/${l.gmail_thread_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View in Gmail <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
