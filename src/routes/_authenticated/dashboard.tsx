import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getDashboardStats, listCampaigns } from "@/lib/acemail.functions";
import { Button } from "@/components/ui/button";
import { Megaphone, Users, Inbox, AtSign, Mail, ArrowUpRight, Plus, AlertTriangle, CheckCircle2 } from "lucide-react";

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

const statusDot: Record<string, string> = {
  running: "bg-success",
  paused: "bg-warning",
  draft: "bg-muted-foreground/50",
  completed: "bg-chart-3",
  discontinued: "bg-destructive",
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Sparkline({ data }: { data: { day: string; sent: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.sent));
  return (
    <div className="flex h-28 items-end gap-1.5" role="img" aria-label="Emails sent over the last 14 days">
      {data.map((d, i) => (
        <div key={d.day} className="group relative flex h-full flex-1 items-end">
          <div
            className={`w-full rounded-sm transition-colors ${i === data.length - 1 ? "bg-signal" : "bg-foreground/15 group-hover:bg-signal/70"}`}
            style={{ height: `${Math.max(4, (d.sent / max) * 100)}%` }}
          />
          <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-1.5 py-0.5 font-mono text-[10px] opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
            {d.sent} · {new Date(d.day).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        </div>
      ))}
    </div>
  );
}

function Dashboard() {
  const { data: stats } = useSuspenseQuery(statsQuery);
  const { data: campaigns } = useSuspenseQuery(campaignsQuery);
  const recent = campaigns.slice(0, 5);
  const bounceRate = stats.sent ? Math.round(((stats.bounced ?? 0) / (stats.sent + (stats.bounced ?? 0))) * 1000) / 10 : 0;
  const replyRate = stats.sent ? Math.round(((stats.replied ?? 0) / stats.sent) * 100) : 0;
  const weekSent = (stats.trend ?? []).slice(-7).reduce((a, d) => a + d.sent, 0);

  const attention = [
    stats.failed > 0 && { text: `${stats.failed} emails failed to send`, to: "/outbox" as const },
    bounceRate > 5 && { text: `Bounce rate is ${bounceRate}% — clean your list`, to: "/contacts" as const },
    stats.totalContacts === 0 && { text: "No contacts yet — import a list", to: "/contacts" as const },
    stats.totalCampaigns === 0 && { text: "Connect Gmail, then create your first campaign", to: "/mailboxes" as const },
  ].filter(Boolean) as { text: string; to: "/outbox" | "/contacts" | "/mailboxes" }[];

  const metrics = [
    { label: "Delivered", value: stats.sent, sub: `${weekSent} this week`, to: "/outbox" as const },
    { label: "Opened", value: stats.opened, sub: `${stats.openRate}% open rate`, to: "/opens" as const },
    { label: "Replied", value: stats.replied ?? 0, sub: `${replyRate}% reply rate`, to: "/inbox" as const },
    { label: "Bounced", value: stats.bounced ?? 0, sub: `${bounceRate}% bounce rate`, to: "/outbox" as const, warn: bounceRate > 5 },
  ];

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">{greeting()}.</h1>
          <p className="mt-2 text-muted-foreground">
            {stats.activeCampaigns > 0
              ? <>{stats.activeCampaigns} campaign{stats.activeCampaigns === 1 ? " is" : "s are"} running{stats.queued ? <>, {stats.queued} emails waiting in the queue</> : null}.</>
              : "Nothing is sending right now."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/contacts"><Users className="mr-2 h-4 w-4" />Import contacts</Link></Button>
          <Button asChild><Link to="/campaigns/new"><Plus className="mr-2 h-4 w-4" />New campaign</Link></Button>
        </div>
      </header>

      <section className="grid overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-soft)] lg:grid-cols-[1.4fr_1fr]">
        <div className="grid grid-cols-2 border-b lg:border-b-0 lg:border-r">
          {metrics.map((m, i) => (
            <Link key={m.label} to={m.to} className={`group p-5 transition-colors hover:bg-muted/50 sm:p-6 ${i % 2 === 0 ? "border-r" : ""} ${i < 2 ? "border-b" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="eyebrow">{m.label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">{m.value.toLocaleString()}</p>
              <p className={`mt-1 text-xs ${m.warn ? "text-destructive" : "text-muted-foreground"}`}>{m.sub}</p>
            </Link>
          ))}
        </div>
        <div className="flex flex-col justify-between gap-6 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Sent · last 14 days</span>
            <span className="font-mono text-xs text-muted-foreground">{stats.totalContacts.toLocaleString()} contacts</span>
          </div>
          <Sparkline data={stats.trend ?? []} />
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg">Campaigns</h2>
            <Link to="/campaigns" className="text-sm text-muted-foreground hover:text-foreground">View all →</Link>
          </div>
          {recent.length === 0 ? (
            <div className="hairline-grid rounded-xl border p-10 text-center">
              <Megaphone className="mx-auto h-6 w-6 text-signal" />
              <p className="mt-3 font-medium">Your first campaign starts here</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Connect a Gmail mailbox, import a contact list, then build a multi-step sequence.</p>
              <Button className="mt-5" asChild><Link to="/campaigns/new">Create campaign</Link></Button>
            </div>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {recent.map((c) => {
                const rate = c.stats.sent ? Math.round((c.stats.opened / c.stats.sent) * 100) : 0;
                return (
                  <li key={c.id}>
                    <Link to="/campaigns/$campaignId" params={{ campaignId: c.id }} className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/50">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot[c.status] ?? "bg-muted-foreground"}`} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          <span className="capitalize">{c.status}</span> · {c.contact_lists?.name ?? "No list"}
                          {c.stats.queued > 0 ? ` · ${c.stats.queued} queued` : ""}
                        </p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <p className="font-mono text-sm tabular-nums">{c.stats.sent}</p>
                        <p className="text-[11px] text-muted-foreground">sent</p>
                      </div>
                      <div className="w-20 text-right">
                        <p className="font-mono text-sm tabular-nums">{rate}%</p>
                        <div className="mt-1 h-1 rounded-full bg-muted"><div className="h-1 rounded-full bg-signal" style={{ width: `${rate}%` }} /></div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg">Needs attention</h2>
            {attention.length === 0 ? (
              <p className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" /> All clear. Nothing needs you right now.
              </p>
            ) : (
              <ul className="space-y-2">
                {attention.map((a) => (
                  <li key={a.text}>
                    <Link to={a.to} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm transition-colors hover:border-signal/50">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                      <span className="flex-1">{a.text}</span>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="mb-3 text-lg">Jump to</h2>
            <div className="grid grid-cols-2 gap-2">
              {([
                { to: "/inbox", label: "Inbox", icon: Inbox },
                { to: "/templates", label: "Templates", icon: Mail },
                { to: "/mailboxes", label: "Mailboxes", icon: AtSign },
                { to: "/contacts", label: "Contacts", icon: Users },
              ] as const).map((a) => (
                <Link key={a.to} to={a.to} className="group flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-sm font-medium transition-colors hover:border-signal/50">
                  <a.icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-signal" />
                  {a.label}
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
