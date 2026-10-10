import { useState } from "react";
import { Mail, Eye, MousePointerClick, MessageSquare, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { percentage, type CampaignAnalytics as Analytics } from "@/lib/campaign-analytics";

export function CampaignAnalytics({ analytics, refresh, refreshing }: { analytics: Analytics; refresh: () => void; refreshing: boolean }) {
  const [filter, setFilter] = useState("all");
  const activity = analytics.activity.filter((event) => filter === "all" || event.kind === filter);
  const metrics = [
    { label: "Sent", value: analytics.sent, detail: `${analytics.sentRecipients} recipients`, icon: Mail },
    { label: "Opened", value: analytics.opened, detail: `${percentage(analytics.opened, analytics.sent)}% of sent emails`, icon: Eye },
    { label: "Clicked", value: analytics.clicked, detail: `${percentage(analytics.clicked, analytics.sent)}% · ${analytics.clickEvents} total clicks`, icon: MousePointerClick },
    { label: "Replied", value: analytics.replied, detail: `${percentage(analytics.replied, analytics.sentRecipients)}% of recipients`, icon: MessageSquare },
  ];
  function download() {
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const csv = ["Event,Recipient,Time,Link", ...activity.map((event) => [event.kind, event.recipient, event.at, event.destination ?? ""].map(quote).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "campaign-recent-activity.csv"; anchor.click(); URL.revokeObjectURL(url);
  }
  return <section className="space-y-4 border-y py-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Campaign analytics</h2><Button variant="ghost" size="icon" title="Refresh analytics" aria-label="Refresh analytics" disabled={refreshing} onClick={refresh}><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /></Button></div>
    <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">{metrics.map((metric) => <div key={metric.label} className="min-w-0 border-l-2 border-primary/40 pl-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><metric.icon className="h-4 w-4" />{metric.label}</div><p className="my-1 text-3xl font-semibold tabular-nums">{metric.value}</p><p className="text-xs text-muted-foreground">{metric.detail}</p></div>)}</div>
    <p className="text-sm text-muted-foreground">{analytics.queued} queued · {analytics.paused} paused · {analytics.failed} failed</p>
    <div className="flex flex-wrap items-center justify-between gap-3"><Tabs value={filter} onValueChange={setFilter}><TabsList className="flex flex-wrap h-auto"><TabsTrigger value="all">All activity</TabsTrigger><TabsTrigger value="opened">Opens</TabsTrigger><TabsTrigger value="clicked">Clicks</TabsTrigger><TabsTrigger value="replied">Replies</TabsTrigger></TabsList></Tabs><Button variant="ghost" size="icon" title="Download recent activity" aria-label="Download recent activity" disabled={!activity.length} onClick={download}><Download className="h-4 w-4" /></Button></div>
    <div className="max-h-80 overflow-auto"><Table><TableHeader><TableRow><TableHead>Recipient</TableHead><TableHead>Event</TableHead><TableHead>Time</TableHead><TableHead>Link</TableHead></TableRow></TableHeader><TableBody>{activity.map((event, index) => <TableRow key={`${event.kind}-${event.at}-${index}`}><TableCell>{event.recipient}</TableCell><TableCell className="capitalize">{event.kind}</TableCell><TableCell className="whitespace-nowrap text-xs">{new Date(event.at).toLocaleString()}</TableCell><TableCell>{event.destination ? <a href={event.destination} target="_blank" rel="noopener noreferrer" className="block max-w-56 truncate text-primary underline" title={event.destination}>{event.destination}</a> : "—"}</TableCell></TableRow>)}{!activity.length && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">No {filter === "all" ? "engagement" : filter} recorded yet.</TableCell></TableRow>}</TableBody></Table></div>
    <p className="text-xs text-muted-foreground">Latest 100 events. Opens and clicks may include email privacy services or automated checks. Time spent on external links is unavailable.</p>
  </section>;
}