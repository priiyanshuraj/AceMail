import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getCrmDashboard } from "@/lib/crm.functions";
import { fmtMoney, stageColor } from "@/lib/crm-colors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KanbanSquare, Users, Activity, Package, FileText, Trophy, Target, TrendingUp, CircleDollarSign, Zap, Building2, Database } from "lucide-react";

const dashQuery = () => queryOptions({ queryKey: ["crm-dashboard"], queryFn: () => getCrmDashboard() });

export const Route = createFileRoute("/_authenticated/crm/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashQuery()),
  head: () => ({ meta: [{ title: "CRM Dashboard | AceMail" }] }),
  component: CrmDashboard,
});

function CrmDashboard() {
  const { data } = useSuspenseQuery(dashQuery());
  const maxMonthly = Math.max(...data.monthlyRevenue.map((m) => m.value), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">CRM</p>
          <h1 className="mt-1 text-3xl font-bold">Overview</h1>
        </div>
      </div>

      {data.migrationRequired && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-500/20 p-2 text-amber-600 dark:text-amber-400 shrink-0">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">CRM Database Setup Required</p>
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                The CRM tables (<code>crm_stages</code>, <code>crm_deals</code>, etc.) have not been created in your Supabase project yet.
                Run the script in <code className="font-mono font-semibold">supabase/migrations/20261111000000_crm_krayin_schema.sql</code> in your <strong>Supabase Dashboard → SQL Editor</strong> to enable database persistence.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick nav */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {[
          { to: "/crm/pipeline", label: "Pipeline", icon: KanbanSquare },
          { to: "/crm/leads", label: "Leads", icon: Zap },
          { to: "/crm/clients", label: "Clients", icon: Users },
          { to: "/crm/organizations", label: "Organizations", icon: Building2 },
          { to: "/crm/activities", label: "Activities", icon: Activity },
          { to: "/crm/products", label: "Products", icon: Package },
          { to: "/crm/quotes", label: "Quotes", icon: FileText },
        ].map(({ to, label, icon: Icon }) => (
          <Button key={to} variant="outline" asChild className="h-auto flex-col gap-1 py-3">
            <Link to={to}><Icon className="h-4 w-4" /><span className="text-xs">{label}</span></Link>
          </Button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { label: "Pipeline", value: fmtMoney(data.totalPipelineValue, data.currency), sub: `${data.openCount} open deals`, icon: CircleDollarSign },
          { label: "Closed Won", value: fmtMoney(data.wonValue, data.currency), sub: `${data.wonCount} deals won`, icon: Trophy },
          { label: "Win Rate", value: `${data.winRate}%`, sub: "Of closed deals", icon: Target },
          { label: "Active Leads", value: String(data.totalLeads), sub: "In pipeline", icon: Zap },
          { label: "Pending Quotes", value: String(data.pendingQuotes), sub: "Draft or sent", icon: FileText },
        ].map(({ label, value, sub, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Revenue Chart */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><TrendingUp className="h-4 w-4 text-primary" /> Monthly Revenue (Won)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex h-36 items-end gap-2 pt-4">
              {data.monthlyRevenue.map((m) => (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5 h-full justify-end">
                  <div
                    className="w-full rounded-t bg-primary/80 transition-all hover:bg-primary"
                    style={{ height: `${Math.max(Math.round((m.value / maxMonthly) * 100), m.value > 0 ? 8 : 0)}%`, minHeight: m.value > 0 ? "6px" : "0px" }}
                    title={`${m.month}: ${fmtMoney(m.value, data.currency)}`}
                  />
                  <span className="text-[10px] text-muted-foreground">{m.month}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Deals by Stage */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Pipeline by Stage</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.dealsByStage.filter((s) => s.count > 0).slice(0, 7).map((s) => {
              const maxCount = Math.max(...data.dealsByStage.map((x) => x.count), 1);
              return (
                <div key={s.stage} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${stageColor(s.color).dot}`} />{s.stage}</span>
                    <span className="tabular-nums text-muted-foreground">{s.count} · {fmtMoney(s.value, data.currency)}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.round((s.count / maxCount) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
            {data.dealsByStage.every((s) => s.count === 0) && <p className="py-6 text-center text-sm text-muted-foreground">No deals in pipeline yet. <Link to="/crm/pipeline" className="text-primary hover:underline">Add one in Pipeline</Link>.</p>}
          </CardContent>
        </Card>

        {/* Upcoming Activities */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm"><Activity className="h-4 w-4 text-primary" /> Upcoming Activities</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link to="/crm/activities">View all</Link></Button>
          </CardHeader>
          <CardContent>
            {data.upcomingActivities.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No upcoming activities. <Link to="/crm/activities" className="text-primary hover:underline">Schedule one</Link>.</p>
            ) : (
              <div className="divide-y">
                {data.upcomingActivities.map((a) => {
                  const contact = a.contacts as { first_name: string; last_name: string; email: string } | null;
                  return (
                    <div key={a.id} className="flex items-center gap-3 py-2.5">
                      <Badge variant="outline" className="shrink-0 capitalize text-xs">{a.type}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.title}</p>
                        {contact && <p className="text-xs text-muted-foreground">{`${contact.first_name} ${contact.last_name}`.trim() || contact.email}</p>}
                      </div>
                      {a.schedule_from && <span className="shrink-0 text-xs text-muted-foreground">{new Date(a.schedule_from).toLocaleDateString()}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Deals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent Deals</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link to="/crm/pipeline">View all</Link></Button>
          </CardHeader>
          <CardContent>
            {data.recentDeals.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No deals yet.</p>
            ) : (
              <div className="divide-y">
                {data.recentDeals.map((d) => {
                  const contact = d.contacts as { first_name: string; last_name: string; email: string; company: string } | null;
                  return (
                    <div key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{contact ? (`${contact.first_name} ${contact.last_name}`.trim() || contact.email) : "Deal"}</p>
                        {contact?.company && <p className="text-xs text-muted-foreground">{contact.company}</p>}
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{fmtMoney(Number(d.value), d.currency)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
