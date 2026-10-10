import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ArrowRight, ArrowLeft } from "lucide-react";

export type CampaignFormValues = {
  name: string;
  list_id: string;
  config_id: string;
  steps: { id?: string; template_id: string; delay_days: number; step_order: number }[];
  send_window_start: string;
  send_window_end: string;
  send_days: number[];
  timezone: string;
  prioritize_followups: boolean;
  breakup_day_exclusive: boolean;
};

type Option = { id: string; name: string };
export type CampaignFormData = {
  lists: (Option & { contact_count: number })[];
  templates: Option[];
  configs: (Option & { from_email: string })[];
};

const browserTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

const allTimezones = (): string[] => {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (fn) return ["UTC", ...fn("timeZone").filter((z) => z !== "UTC")];
  } catch {
    /* ignore */
  }
  return ["UTC", "Asia/Kolkata", "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles", "Asia/Singapore", "Asia/Dubai", "Australia/Sydney"];
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CampaignForm({
  data,
  initial,
  title,
  submitLabel,
  onSubmit,
}: {
  data: CampaignFormData;
  initial?: Partial<CampaignFormValues>;
  title: string;
  submitLabel: string;
  onSubmit: (values: CampaignFormValues) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name ?? "");
  const [listId, setListId] = useState(initial?.list_id ?? "");
  const [configId, setConfigId] = useState(initial?.config_id ?? "");
  const [steps, setSteps] = useState<{ id?: string; template_id: string; delay_days: number }[]>(
    initial?.steps?.length ? initial.steps : [{ template_id: "", delay_days: 0 }]
  );
  const [sendDays, setSendDays] = useState<number[]>(initial?.send_days ?? [1, 2, 3, 4, 5]);
  const [windowStart, setWindowStart] = useState(initial?.send_window_start?.slice(0, 5) || "09:00");
  const [windowEnd, setWindowEnd] = useState(initial?.send_window_end?.slice(0, 5) || "17:00");
  const [timezone, setTimezone] = useState(initial?.timezone || browserTz());
  const [zones] = useState(() => {
    const z = allTimezones();
    return z.includes(timezone) ? z : [timezone, ...z];
  });
  const [prioritize, setPrioritize] = useState(initial?.prioritize_followups ?? true);
  const [breakupOnly, setBreakupOnly] = useState(initial?.breakup_day_exclusive ?? false);
  const [saving, setSaving] = useState(false);

  const canNext =
    step === 0
      ? name.trim() && listId && configId
      : step === 1
        ? steps.every((s) => s.template_id)
        : sendDays.length > 0;

  const handleCreate = async () => {
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        list_id: listId,
        config_id: configId,
        steps: steps.map((s, i) => ({ ...s, step_order: i + 1 })),
        send_window_start: windowStart,
        send_window_end: windowEnd,
        send_days: sendDays,
        timezone,
        prioritize_followups: prioritize,
        breakup_day_exclusive: prioritize && breakupOnly,
      });
    } finally {
      setSaving(false);
    }
  };

  const stepTitles = ["Basics", "Email sequence", "Schedule"];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Step {step + 1} of 3 — {stepTitles[step]}
        </p>
      </div>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Basics</CardTitle>
            <CardDescription>Name the campaign and choose who it goes to and from.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Campaign name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q4 founder outreach" />
            </div>
            <div className="space-y-1">
              <Label>Contact list</Label>
              <Select value={listId} onValueChange={setListId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a list" />
                </SelectTrigger>
                <SelectContent>
                  {data.lists.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} ({l.contact_count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {data.lists.length === 0 && (
                <p className="text-xs text-destructive">Create a contact list first (Contacts page).</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Send from mailbox</Label>
              <Select value={configId} onValueChange={setConfigId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a configuration" />
                </SelectTrigger>
                <SelectContent>
                  {data.configs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} — {c.from_email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {data.configs.length === 0 && (
                <p className="text-xs text-destructive">Connect a Gmail mailbox first (Mailboxes page).</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Email sequence</CardTitle>
            <CardDescription>The first email plus optional follow-ups with delays.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {steps.map((s, i) => (
              <div key={i} className="flex items-end gap-3 rounded-lg border p-3">
                <div className="flex-1 space-y-1">
                  <Label>{i === 0 ? "Initial email" : `Follow-up ${i}`}</Label>
                  <Select
                    value={s.template_id}
                    onValueChange={(v) => setSteps(steps.map((x, j) => (j === i ? { ...x, template_id: v } : x)))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {i > 0 && (
                  <div className="w-28 space-y-1">
                    <Label>Wait (days)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={s.delay_days}
                      onChange={(e) =>
                        setSteps(steps.map((x, j) => (j === i ? { ...x, delay_days: Number(e.target.value) } : x)))
                      }
                    />
                  </div>
                )}
                {steps.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
            {data.templates.length === 0 && (
              <p className="text-xs text-destructive">Create a template first (Templates page).</p>
            )}
            <Button
              variant="outline"
              onClick={() => setSteps([...steps, { template_id: "", delay_days: 3 }])}
            >
              <Plus className="mr-2 h-4 w-4" /> Add follow-up
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>Control when emails are allowed to go out.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Send on days</Label>
              <div className="flex flex-wrap gap-3">
                {DAYS.map((d, i) => (
                  <label key={d} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={sendDays.includes(i)}
                      onCheckedChange={(checked) =>
                        setSendDays(
                          checked ? [...sendDays, i].sort() : sendDays.filter((x) => x !== i)
                        )
                      }
                    />
                    {d}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Time zone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {zones.map((z) => (
                    <SelectItem key={z} value={z}>
                      {z.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Send days and window follow this time zone.</p>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <Label>Window start</Label>
                <Input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
              </div>
              <div className="flex-1 space-y-1">
                <Label>Window end</Label>
                <Input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-3 rounded-lg border p-3">
              <label className="flex items-start justify-between gap-4">
                <span>
                  <span className="block text-sm font-medium">Prioritize follow-ups</span>
                  <span className="block text-xs text-muted-foreground">
                    When follow-ups are due, they use the daily limit first. New first emails only go out with whatever is left.
                  </span>
                </span>
                <Switch checked={prioritize} onCheckedChange={setPrioritize} />
              </label>
              <label className={`ml-4 flex items-start justify-between gap-4 border-l pl-4 ${prioritize ? "" : "opacity-50"}`}>
                <span>
                  <span className="block text-sm font-medium">Break-up day: send only the last email</span>
                  <span className="block text-xs text-muted-foreground">
                    On days when final (break-up) emails are due, nothing else is sent so they all fit in the limit. Other emails wait for the next day.
                  </span>
                </span>
                <Switch
                  checked={prioritize && breakupOnly}
                  disabled={!prioritize || steps.length < 2}
                  onCheckedChange={setBreakupOnly}
                />
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        {step < 2 ? (
          <Button disabled={!canNext} onClick={() => setStep(step + 1)}>
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button disabled={!canNext || saving} onClick={handleCreate}>
            {saving ? "Saving…" : submitLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
