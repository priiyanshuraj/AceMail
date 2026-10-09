import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { getCampaign, setCampaignStatus } from "@/lib/acemail.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Play, Pause, Square, Pencil } from "lucide-react";
import { toast } from "sonner";

const campaignQuery = (id: string) =>
  queryOptions({
    queryKey: ["campaign", id],
    queryFn: () => getCampaign({ data: { id } }),
  });

export const Route = createFileRoute("/_authenticated/campaigns/$campaignId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(campaignQuery(params.campaignId)),
  head: () => ({
    meta: [
      { title: "Campaign details — AceMail" },
      { name: "description", content: "Campaign steps, delivery log, and performance." },
      { property: "og:title", content: "Campaign details — AceMail" },
      { property: "og:description", content: "Campaign steps, delivery log, and performance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CampaignDetail,
});

function CampaignDetail() {
  const { campaignId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(campaignQuery(campaignId));
  const { campaign, steps, logs } = data;

  const changeStatus = async (status: "running" | "paused" | "discontinued") => {
    try {
      await setCampaignStatus({ data: { id: campaignId, status } });
      queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success(`Campaign ${status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const stepStats = (stepId: string) => {
    const rows = logs.filter((l) => l.step_id === stepId);
    return {
      sent: rows.filter((l) => l.status === "sent" || l.status === "opened").length,
      opened: rows.filter((l) => l.status === "opened").length,
      failed: rows.filter((l) => l.status === "failed").length,
      queued: rows.filter((l) => l.status === "queued").length,
    };
  };

  const list = campaign.contact_lists as { name: string } | null;
  const config = campaign.email_configurations as { name: string; from_email: string } | null;

  return (
    <div className="space-y-6">
      <Link to="/campaigns" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> All campaigns
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <Badge>{campaign.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            To {list?.name ?? "—"} · From {config?.from_email ?? "—"} · {campaign.send_window_start?.slice(0, 5)}–
            {campaign.send_window_end?.slice(0, 5)} ({campaign.timezone})
          </p>
        </div>
        <div className="flex gap-2">
          {campaign.status !== "completed" && campaign.status !== "discontinued" && (
            <Button variant="outline" asChild>
              <Link to="/campaigns/edit/$campaignId" params={{ campaignId }}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Link>
            </Button>
          )}
          {campaign.status !== "running" && campaign.status !== "completed" && campaign.status !== "discontinued" && (
            <Button onClick={() => changeStatus("running")}>
              <Play className="mr-2 h-4 w-4" /> Start
            </Button>
          )}
          {campaign.status === "running" && (
            <Button variant="outline" onClick={() => changeStatus("paused")}>
              <Pause className="mr-2 h-4 w-4" /> Pause
            </Button>
          )}
          {(campaign.status === "running" || campaign.status === "paused") && (
            <Button variant="outline" onClick={() => changeStatus("discontinued")}>
              <Square className="mr-2 h-4 w-4" /> Stop
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sequence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((s) => {
            const st = stepStats(s.id);
            const tpl = s.email_templates as { name: string; subject: string } | null;
            return (
              <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">
                    Step {s.step_order}: {tpl?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.step_order === 1 ? "Sent first" : `${s.delay_days} days after previous`} · "{tpl?.subject}"
                  </p>
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>Queued {st.queued}</span>
                  <span>Sent {st.sent}</span>
                  <span>Opened {st.opened}</span>
                  <span>Failed {st.failed}</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delivery log</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => {
                const c = l.contacts as { email: string } | null;
                return (
                  <TableRow key={l.id}>
                    <TableCell>{c?.email}</TableCell>
                    <TableCell>
                      <Badge variant={l.status === "failed" ? "destructive" : "secondary"}>{l.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{new Date(l.scheduled_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{l.sent_at ? new Date(l.sent_at).toLocaleString() : "—"}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-destructive">{l.error ?? ""}</TableCell>
                  </TableRow>
                );
              })}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nothing queued yet — start the campaign to enqueue emails.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
