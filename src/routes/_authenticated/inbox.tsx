import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listInbox, markInboxRead, syncInboxNow } from "@/lib/mailbox.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const inboxQuery = queryOptions({ queryKey: ["inbox"], queryFn: () => listInbox() });

export const Route = createFileRoute("/_authenticated/inbox")({
  loader: ({ context }) => context.queryClient.ensureQueryData(inboxQuery),
  head: () => ({
    meta: [
      { title: "Inbox — AceMail" },
      { name: "description", content: "All campaign replies from every connected mailbox in one place." },
      { property: "og:title", content: "Inbox — AceMail" },
      { property: "og:description", content: "All campaign replies from every connected mailbox in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InboxPage,
});

function InboxPage() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(inboxQuery);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [syncing, setSyncing] = useState(false);
  const rows = filter === "unread" ? data.filter((m) => !m.is_read) : data;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["inbox"] });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Replies to your campaigns from every mailbox. Contacts who reply are automatically removed from follow-ups.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={syncing}
          onClick={async () => {
            setSyncing(true);
            try {
              const r = await syncInboxNow();
              toast.success(r.synced ? `${r.synced} new repl${r.synced === 1 ? "y" : "ies"}` : "No new replies");
              refresh();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not check mailboxes");
            } finally {
              setSyncing(false);
            }
          }}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> Check now
        </Button>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
          All ({data.length})
        </Button>
        <Button size="sm" variant={filter === "unread" ? "default" : "outline"} onClick={() => setFilter("unread")}>
          Unread ({data.filter((m) => !m.is_read).length})
        </Button>
      </div>

      <Card>
        <CardContent className="divide-y p-0">
          {rows.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">No replies yet. They'll show up here automatically.</p>
          )}
          {rows.map((m) => {
            const campaign = m.campaigns as { name: string } | null;
            const box = m.email_configurations as { from_email: string } | null;
            return (
              <div
                key={m.id}
                className={`flex cursor-pointer items-start gap-4 p-4 hover:bg-muted/40 ${m.is_read ? "" : "bg-accent/30"}`}
                onClick={async () => {
                  await markInboxRead({ data: { id: m.id, is_read: !m.is_read } });
                  refresh();
                }}
              >
                <div className={`mt-2 h-2 w-2 shrink-0 rounded-full ${m.is_read ? "bg-transparent" : "bg-primary"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={m.is_read ? "" : "font-semibold"}>{m.from_name || m.from_email}</span>
                    <span className="text-xs text-muted-foreground">{m.from_email}</span>
                    {campaign && <Badge variant="outline">{campaign.name}</Badge>}
                  </div>
                  <p className="truncate text-sm">{m.subject}</p>
                  <p className="truncate text-sm text-muted-foreground">{m.snippet}</p>
                  {box && <p className="mt-1 text-xs text-muted-foreground">to {box.from_email}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-xs text-muted-foreground">{new Date(m.received_at).toLocaleString()}</span>
                  {m.gmail_thread_id && (
                    <a
                      href={`https://mail.google.com/mail/u/${box?.from_email ?? 0}/#inbox/${m.gmail_thread_id}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Reply in Gmail <ExternalLink className="h-3 w-3" />
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
