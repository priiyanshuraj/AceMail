import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getClientBoard } from "@/lib/crm.functions";
import { stageColor, fmtMoney } from "@/lib/crm-colors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Bell, KanbanSquare } from "lucide-react";

const boardQuery = () => queryOptions({ queryKey: ["crm-clients"], queryFn: () => getClientBoard() });

export const Route = createFileRoute("/_authenticated/crm/clients")({
  loader: ({ context }) => context.queryClient.ensureQueryData(boardQuery()),
  head: () => ({
    meta: [
      { title: "Client Board | AceMail" },
      { name: "description", content: "Every client with open deals, their pipeline stage, value and upcoming reminders." },
      { property: "og:title", content: "Client Board | AceMail" },
      { property: "og:description", content: "Every client with open deals, their pipeline stage, value and upcoming reminders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientBoardPage,
});

function ClientBoardPage() {
  const { data } = useSuspenseQuery(boardQuery());
  const { stages, deals, reminders } = data;
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const dueReminders = reminders.filter((r) => r.remind_at && new Date(r.remind_at).getTime() <= Date.now());

  // Group deals by contact so each client appears once.
  const byContact = new Map<string, { contact: NonNullable<(typeof deals)[number]["contacts"]>; deals: typeof deals }>();
  for (const d of deals) {
    if (!d.contacts) continue;
    const entry = byContact.get(d.contacts.id) ?? { contact: d.contacts, deals: [] };
    entry.deals.push(d);
    byContact.set(d.contacts.id, entry);
  }
  const clients = [...byContact.values()];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/crm" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" /> Pipeline
          </Link>
          <h1 className="text-2xl font-bold">Client board</h1>
          <p className="text-sm text-muted-foreground">{clients.length} clients with deals in the pipeline</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/crm"><KanbanSquare className="mr-2 h-4 w-4" /> Open pipeline</Link>
        </Button>
      </div>

      {dueReminders.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4" /> Reminders due</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {dueReminders.map((r) => (
              <p key={r.id} className="text-sm">
                <span className="text-muted-foreground">{new Date(r.remind_at!).toLocaleString()}:</span> {r.body}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Open deals</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Last update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No clients in the pipeline yet. Add a deal from the pipeline board.
                  </TableCell>
                </TableRow>
              )}
              {clients.map(({ contact, deals: cds }) => {
                const open = cds.filter((d) => {
                  const s = stageById.get(d.stage_id);
                  return s && !s.is_won && !s.is_lost;
                });
                const latest = cds[0]!;
                const stage = stageById.get(latest.stage_id);
                const total = open.reduce((s, d) => s + Number(d.value), 0);
                return (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <Link to="/crm/clients/$contactId" params={{ contactId: contact.id }} className="font-medium hover:underline">
                        {`${contact.first_name} ${contact.last_name}`.trim() || contact.email}
                      </Link>
                      <p className="text-xs text-muted-foreground">{contact.email}</p>
                    </TableCell>
                    <TableCell className="text-sm">{contact.company || "—"}</TableCell>
                    <TableCell className="text-sm">{open.length} open · {cds.length} total</TableCell>
                    <TableCell>
                      {stage && (
                        <Badge variant="outline" className="gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${stageColor(stage.color).dot}`} />
                          {stage.name}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">{total > 0 ? fmtMoney(total, latest.currency) : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(latest.updated_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
