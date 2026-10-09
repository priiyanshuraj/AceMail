import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { listCampaigns, setCampaignStatus, deleteCampaign } from "@/lib/acemail.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Pause, Trash2, Megaphone } from "lucide-react";
import { toast } from "sonner";

const campaignsQuery = queryOptions({
  queryKey: ["campaigns"],
  queryFn: () => listCampaigns(),
});

export const Route = createFileRoute("/_authenticated/campaigns/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(campaignsQuery),
  head: () => ({
    meta: [
      { title: "Campaigns — AceMail" },
      { name: "description", content: "Manage your cold email campaigns." },
      { property: "og:title", content: "Campaigns — AceMail" },
      { property: "og:description", content: "Manage your cold email campaigns." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CampaignsPage,
});

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  running: "default",
  paused: "secondary",
  completed: "secondary",
  discontinued: "destructive",
};

function CampaignsPage() {
  const queryClient = useQueryClient();
  const { data: campaigns } = useSuspenseQuery(campaignsQuery);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["campaigns"] });

  const toggleStatus = async (id: string, current: string) => {
    try {
      await setCampaignStatus({
        data: { id, status: current === "running" ? "paused" : "running" },
      });
      refresh();
      toast.success(current === "running" ? "Campaign paused" : "Campaign started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update campaign");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Multi-step outreach sequences</p>
        </div>
        <Button asChild>
          <Link to="/campaigns/new">
            <Plus className="mr-2 h-4 w-4" /> New campaign
          </Link>
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Megaphone className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No campaigns yet. Create one to start reaching out.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">
                    <Link to="/campaigns/$campaignId" params={{ campaignId: c.id }} className="hover:underline">
                      {c.name}
                    </Link>
                  </CardTitle>
                  <Badge variant={statusVariant[c.status] ?? "outline"}>{c.status}</Badge>
                </div>
                <div className="flex gap-1">
                  {(c.status === "draft" || c.status === "paused" || c.status === "running") && (
                    <Button variant="ghost" size="icon" onClick={() => toggleStatus(c.id, c.status)}>
                      {c.status === "running" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      await deleteCampaign({ data: { id: c.id } });
                      refresh();
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6 text-sm text-muted-foreground">
                  <span>List: {(c.contact_lists as { name: string } | null)?.name ?? "—"}</span>
                  <span>Queued: {c.stats.queued}</span>
                  <span>Sent: {c.stats.sent}</span>
                  <span>Opened: {c.stats.opened}</span>
                  <span>Failed: {c.stats.failed}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
