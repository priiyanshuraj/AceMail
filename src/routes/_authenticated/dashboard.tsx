import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getDashboardStats, listCampaigns } from "@/lib/acemail.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Megaphone, Users, Send, MailOpen, AlertCircle, TrendingUp, Inbox, AtSign, Mail, ArrowRight } from "lucide-react";
import fieldAsset from "@/assets/kiarostami-field.jpg.asset.json";

const statsQuery = queryOptions({
  queryKey: ["dashboard-stats"],
  queryFn: () => getDashboardStats(),
});

const campaignsQuery = queryOptions({
  queryKey: ["dashboard-campaigns"],
  queryFn: () => listCampaigns(),
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
  const { data: campaigns } = useSuspenseQuery(campaignsQuery);
  const recent = campaigns.slice(0, 3);

  const cards = [
    { label: "Active campaigns", value: stats.activeCampaigns, sub: `${stats.totalCampaigns} total`, icon: Megaphone, to: "/campaigns" },
    { label: "Contacts", value: stats.totalContacts, sub: "across all lists", icon: Users, to: "/contacts" },
    { label: "Emails sent", value: stats.sent, sub: `${stats.failed} failed`, icon: Send, to: "/campaigns" },
    { label: "Opens", value: stats.opened, sub: "tracked opens", icon: MailOpen, to: "/opens" },
    { label: "Open rate", value: `${stats.openRate}%`, sub: "of sent emails", icon: TrendingUp, to: "/opens" },
  ] as const;

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
          <Link key={c.label} to={c.to} className="block transition-transform hover:-translate-y-0.5">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{c.value}</div>
                <p className="text-xs text-muted-foreground">{c.sub}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-xl">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {([
              { to: "/campaigns", label: "Launch a campaign", desc: "Build a multi-step sequence", icon: Megaphone },
              { to: "/contacts", label: "Import contacts", desc: "CSV upload or Google Sheets", icon: Users },
              { to: "/templates", label: "Write a template", desc: "Personalize with variables", icon: Mail },
              { to: "/inbox", label: "Check replies", desc: "Your unified inbox", icon: Inbox },
              { to: "/mailboxes", label: "Manage mailboxes", desc: "Limits, warmup, health", icon: AtSign },
              { to: "/opens", label: "See who opened", desc: "Every tracked open", icon: MailOpen },
            ] as const).map((a) => (
              <Link
                key={a.to + a.label}
                to={a.to}
                className="group flex items-center gap-3 rounded-md border bg-muted/40 p-3 transition-colors hover:border-primary/60 hover:bg-primary/10"
              >
                <a.icon className="h-5 w-5 text-amber" />
                <div className="flex-1">
                  <div className="text-sm font-semibold">{a.label}</div>
                  <div className="text-xs text-muted-foreground">{a.desc}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <img
            src={fieldAsset.url}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card/95 via-card/55 to-card/15" />
          <CardContent className="relative flex h-full flex-col justify-center gap-4 p-6">
            <span className="text-xs uppercase tracking-[0.4em] text-jade">The road so far</span>
            <blockquote className="font-serif text-xl italic leading-snug">
              "The road is long, and the wind is in the olive trees."
            </blockquote>
            <p className="text-xs text-muted-foreground">— after The Wind Will Carry Us. Keep following the road.</p>
            <p className="text-sm">
              Open rate: <span className="neon-text font-semibold">{stats.openRate}%</span> ·{" "}
              {stats.sent} sent · {stats.failed} failed
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl">Recent campaigns</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/campaigns">
              All campaigns <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No campaigns yet — the road is waiting. Launch your first one and watch it carry your message down the hills.
            </p>
          ) : (
            <ul className="divide-y">
              {recent.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-3">
                  <Megaphone className="h-4 w-4 shrink-0 text-amber" />
                  <div className="min-w-0 flex-1">
                    <Link to="/campaigns" className="block truncate text-sm font-semibold hover:underline">
                      {c.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.contact_lists?.name ?? "No list"} · {c.stats.sent} sent · {c.stats.opened} opened
                      {c.stats.queued > 0 ? ` · ${c.stats.queued} queued` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 capitalize">{c.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
