import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/lib/acemail.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Megaphone, Users, Send, MailOpen, AlertCircle, TrendingUp } from "lucide-react";

const statsQuery = queryOptions({
  queryKey: ["dashboard-stats"],
  queryFn: () => getDashboardStats(),
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(statsQuery),
  head: () => ({
    meta: [
      { title: "Dashboard — AceMail" },
      { name: "description", content: "Campaign performance at a glance." },
      { property: "og:title", content: "Dashboard — AceMail" },
      { property: "og:description", content: "Campaign performance at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useSuspenseQuery(statsQuery);

  const cards = [
    { label: "Active campaigns", value: stats.activeCampaigns, sub: `${stats.totalCampaigns} total`, icon: Megaphone },
    { label: "Contacts", value: stats.totalContacts, sub: "across all lists", icon: Users },
    { label: "Emails sent", value: stats.sent, sub: `${stats.failed} failed`, icon: Send },
    { label: "Opens", value: stats.opened, sub: "tracked opens", icon: MailOpen },
    { label: "Open rate", value: `${stats.openRate}%`, sub: "of sent emails", icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your outreach at a glance</p>
        </div>
        <Button asChild>
          <Link to="/campaigns">New campaign</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
              <p className="text-xs text-muted-foreground">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.totalCampaigns === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No campaigns yet</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Get started in three steps: connect your Gmail on the Mailboxes page, import a contact
              list, then create your first campaign.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link to="/mailboxes">Connect Gmail</Link>
              </Button>
              <Button asChild>
                <Link to="/campaigns">Create campaign</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
