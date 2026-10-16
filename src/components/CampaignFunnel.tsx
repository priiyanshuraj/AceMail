import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { getCampaignFunnel } from "@/lib/outreach.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const LABELS: Record<string, string> = { waiting: "Waiting", sent: "Sent", replied: "Replied", bounced: "Bounced", failed: "Failed", stopped: "Stopped" };

export function CampaignFunnel({ campaignId }: { campaignId: string }) {
  const { data } = useQuery({ queryKey: ["campaign-funnel", campaignId], queryFn: () => getCampaignFunnel({ data: { campaignId } }), refetchInterval: 60000 });
  const [open, setOpen] = useState<number | null>(null);
  if (!data || data.contacts === 0) return null;
  const max = Math.max(1, ...data.funnel.map((s) => s.total));
  const sel = data.funnel.find((s) => s.step === open);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline</CardTitle>
        <CardDescription>Where each of the {data.contacts} people currently sits. Click a step to see who.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.funnel.map((s) => (
          <button key={s.step} type="button" onClick={() => setOpen(open === s.step ? null : s.step)} className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 ${open === s.step ? "border-primary" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium">Step {s.step}: {s.total} people</span>
              <span className="flex flex-wrap gap-2 text-xs text-muted-foreground">{Object.entries(s.counts).map(([k, v]) => <span key={k}>{LABELS[k] ?? k} {v}</span>)}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(s.total / max) * 100}%` }} /></div>
          </button>
        ))}
        {sel && (
          <div className="max-h-80 divide-y overflow-y-auto rounded-lg border">
            {sel.people.length === 0 && <p className="p-3 text-sm text-muted-foreground">No one at this step.</p>}
            {sel.people.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <Link to="/contacts/$contactId" params={{ contactId: p.id }} className="min-w-0 flex-1 truncate hover:underline">{p.name || p.email} <span className="text-muted-foreground">{p.name ? p.email : ""}</span></Link>
                <Badge variant={p.state === "bounced" || p.state === "failed" ? "destructive" : "secondary"}>{LABELS[p.state] ?? p.state}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
