import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listMailboxes,
  startGmailConnect,
  completeGmailConnection,
  updateMailbox,
  disconnectMailbox,
  sendTestEmail,
} from "@/lib/mailbox.functions";
import { listTemplates } from "@/lib/acemail.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Flame, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

const mailboxesQuery = queryOptions({
  queryKey: ["mailboxes"],
  queryFn: async () => {
    const [boxes, templates] = await Promise.all([listMailboxes(), listTemplates()]);
    return { boxes, templates };
  },
});

export const Route = createFileRoute("/_authenticated/mailboxes")({
  loader: ({ context }) => context.queryClient.ensureQueryData(mailboxesQuery),
  head: () => ({
    meta: [
      { title: "Mailboxes — AceMail" },
      { name: "description", content: "Connect Gmail mailboxes, set sending limits, warmup and preview emails." },
      { property: "og:title", content: "Mailboxes — AceMail" },
      { property: "og:description", content: "Connect Gmail mailboxes, set sending limits, warmup and preview emails." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MailboxesPage,
});

type Box = Awaited<ReturnType<typeof listMailboxes>>[number];
type Template = Awaited<ReturnType<typeof listTemplates>>[number];

function waitForOAuth(popup: Window) {
  return new Promise<string | null>((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        event.data?.connectorId !== "google_mail" ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      )
        return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") resolve(typeof event.data.code === "string" ? event.data.code : null);
      else {
        popup.close();
        reject(new Error("Google connection failed."));
      }
    };
    window.addEventListener("message", onMessage);
    const poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("The Google window was closed before finishing."));
    }, 500);
  });
}

async function connectGmail(configId?: string) {
  const popup = window.open("", "acemail-gmail", "width=600,height=720");
  if (!popup) throw new Error("Popup blocked. Allow popups and try again.");
  let code: string | null;
  let appUserId: string;
  try {
    const res = await startGmailConnect({ data: { configId } });
    appUserId = res.appUserId;
    const done = waitForOAuth(popup);
    popup.location.href = res.authorizationUrl;
    code = await done;
  } catch (e) {
    popup.close();
    throw e;
  }
  if (!code) throw new Error("Google did not grant ongoing access. Please try again.");
  return completeGmailConnection({ data: { code, appUserId } });
}

function MailboxesPage() {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(mailboxesQuery);
  const [connecting, setConnecting] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["mailboxes"] });

  const onConnect = async (configId?: string) => {
    setConnecting(true);
    try {
      const r = await connectGmail(configId);
      toast.success(r.reconnected ? `Reconnected ${r.email}` : `Connected ${r.email}`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not connect");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mailboxes</h1>
          <p className="text-sm text-muted-foreground">Connect your Gmail with one click — no passwords or server settings.</p>
        </div>
        <Button onClick={() => onConnect()} disabled={connecting}>
          <Plus className="mr-2 h-4 w-4" /> {connecting ? "Connecting…" : "Connect Gmail"}
        </Button>
      </div>

      {data.boxes.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-medium">No mailboxes connected</p>
            <p className="mt-1 text-sm text-muted-foreground">Sign in with Google to send campaigns from your own Gmail and track replies.</p>
            <Button className="mt-4" onClick={() => onConnect()} disabled={connecting}>
              Connect Gmail
            </Button>
          </CardContent>
        </Card>
      )}

      {data.boxes.map((b) => (
        <MailboxCard key={b.id} box={b} templates={data.templates} onReconnect={() => onConnect(b.id)} onChange={refresh} />
      ))}
    </div>
  );
}

const healthLabel: Record<string, { text: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  good: { text: "Healthy", variant: "secondary" },
  fair: { text: "Fair", variant: "outline" },
  at_risk: { text: "At risk", variant: "destructive" },
  reconnect: { text: "Reconnect needed", variant: "destructive" },
};

function MailboxCard({
  box,
  templates,
  onReconnect,
  onChange,
}: {
  box: Box;
  templates: Template[];
  onReconnect: () => void;
  onChange: () => void;
}) {
  const [form, setForm] = useState({
    from_name: box.from_name,
    daily_limit: box.daily_limit,
    hourly_limit: box.hourly_limit,
    delay_seconds: box.delay_seconds,
    warmup_enabled: box.warmup_enabled,
    warmup_start_volume: box.warmup_start_volume,
    warmup_increment: box.warmup_increment,
    is_default: box.is_default,
  });
  const [preview, setPreview] = useState(false);
  const h = healthLabel[box.health] ?? healthLabel["good"]!;
  const limit = box.effective_daily_limit;

  const save = async () => {
    try {
      await updateMailbox({ data: { id: box.id, ...form } });
      toast.success("Mailbox settings saved");
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Check the values and try again");
    }
  };

  const num = (key: keyof typeof form, label: string, hint?: string) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="number" value={Number(form[key])} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {box.from_email}
            <Badge variant={h.variant}>{h.text}</Badge>
            {box.is_default && <Badge variant="outline">default</Badge>}
            {box.warmup_enabled && (
              <Badge variant="outline" className="gap-1">
                <Flame className="h-3 w-3 text-primary" /> warming up
              </Badge>
            )}
            {box.provider !== "gmail" && <Badge variant="outline">SMTP (legacy)</Badge>}
          </CardTitle>
          <CardDescription>
            {box.last_synced_at ? `Replies checked ${new Date(box.last_synced_at).toLocaleString()}` : "Replies not checked yet"}
          </CardDescription>
        </div>
        <div className="flex gap-1">
          {box.provider === "gmail" && (
            <Button variant="outline" size="sm" onClick={onReconnect}>
              <RefreshCw className="mr-1 h-3 w-3" /> Reconnect
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setPreview(true)}>
            <Eye className="mr-1 h-3 w-3" /> Preview
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              if (!confirm(`Disconnect ${box.from_email}? Campaigns using it will stop sending.`)) return;
              await disconnectMailbox({ data: { id: box.id } });
              onChange();
            }}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Sent today" value={`${box.stats.sentToday} / ${limit}`} progress={(box.stats.sentToday / Math.max(1, limit)) * 100} />
          <Stat label="This hour" value={`${box.stats.sentHour} / ${box.hourly_limit}`} progress={(box.stats.sentHour / Math.max(1, box.hourly_limit)) * 100} />
          <Stat label="Replies (7d)" value={String(box.stats.replied7d)} />
          <Stat label="Bounce rate (7d)" value={`${(box.stats.bounceRate * 100).toFixed(1)}%`} />
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1 md:col-span-2">
            <Label>Sender name</Label>
            <Input value={form.from_name} placeholder="Jane at Acme" onChange={(e) => setForm({ ...form, from_name: e.target.value })} />
          </div>
          {num("daily_limit", "Emails per day")}
          {num("hourly_limit", "Emails per hour")}
          {num("delay_seconds", "Gap between emails (sec)")}
        </div>

        <div className="space-y-4 rounded-lg border p-4">
          <label className="flex items-center gap-3">
            <Switch checked={form.warmup_enabled} onCheckedChange={(v) => setForm({ ...form, warmup_enabled: v })} />
            <span>
              <span className="font-medium">Warmup</span>
              <span className="block text-xs text-muted-foreground">
                Start low and raise daily volume gradually to protect your sender reputation.
              </span>
            </span>
          </label>
          {form.warmup_enabled && (
            <div className="grid gap-4 md:grid-cols-3">
              {num("warmup_start_volume", "Start at (emails/day)")}
              {num("warmup_increment", "Increase per day")}
              <div className="space-y-1">
                <Label>Today's cap</Label>
                <p className="pt-2 text-sm">
                  {limit} of {form.daily_limit} per day
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
            Default mailbox for new campaigns
          </label>
          <Button onClick={save}>Save settings</Button>
        </div>
      </CardContent>

      <PreviewDialog open={preview} onOpenChange={setPreview} box={box} templates={templates} senderName={form.from_name} />
    </Card>
  );
}

function Stat({ label, value, progress }: { label: string; value: string; progress?: number }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      {progress !== undefined && <Progress value={Math.min(100, progress)} className="h-1.5" />}
    </div>
  );
}

const sample = { first_name: "Alex", last_name: "Sample", company: "Acme Inc" };

function PreviewDialog({
  open,
  onOpenChange,
  box,
  templates,
  senderName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  box: Box;
  templates: Template[];
  senderName: string;
}) {
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? "");
  const [sending, setSending] = useState(false);
  const tpl = templates.find((t) => t.id === templateId);
  const render = (t: string) =>
    t
      .replaceAll("{{first_name}}", sample.first_name)
      .replaceAll("{{last_name}}", sample.last_name)
      .replaceAll("{{company}}", sample.company)
      .replaceAll("{{email}}", "alex@acme.com");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Preview email</DialogTitle>
        </DialogHeader>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Create a template first to preview it here.</p>
        ) : (
          <div className="space-y-4">
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {tpl && (
              <div className="overflow-hidden rounded-lg border bg-card">
                <div className="space-y-1 border-b bg-muted/40 p-4 text-sm">
                  <p>
                    <span className="text-muted-foreground">From: </span>
                    {senderName ? `${senderName} <${box.from_email}>` : box.from_email}
                  </p>
                  <p>
                    <span className="text-muted-foreground">To: </span>Alex Sample &lt;alex@acme.com&gt;
                  </p>
                  <p className="font-semibold">{render(tpl.subject)}</p>
                </div>
                <div
                  className="prose prose-sm max-w-none p-4 text-sm"
                  dangerouslySetInnerHTML={{ __html: escapeHtml(render(tpl.body)).replace(/\n/g, "<br />") }}
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Sample contact: Alex Sample at Acme Inc</p>
              <Button
                disabled={!tpl || sending || box.provider !== "gmail"}
                onClick={async () => {
                  setSending(true);
                  try {
                    const r = await sendTestEmail({ data: { configId: box.id, templateId } });
                    toast.success(`Test email sent to ${r.to}`);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Test send failed");
                  } finally {
                    setSending(false);
                  }
                }}
              >
                {sending ? "Sending…" : "Send test to myself"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
