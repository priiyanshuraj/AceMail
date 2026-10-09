import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  listContactLists,
  listTemplates,
  listEmailConfigs,
  createCampaign,
} from "@/lib/acemail.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const wizardDataQuery = queryOptions({
  queryKey: ["campaign-wizard-data"],
  queryFn: async () => {
    const [lists, templates, configs] = await Promise.all([
      listContactLists(),
      listTemplates(),
      listEmailConfigs(),
    ]);
    return { lists, templates, configs };
  },
});

export const Route = createFileRoute("/_authenticated/campaigns/new")({
  loader: ({ context }) => context.queryClient.ensureQueryData(wizardDataQuery),
  head: () => ({
    meta: [
      { title: "New campaign — AceMail" },
      { name: "description", content: "Create a multi-step email campaign." },
      { property: "og:title", content: "New campaign — AceMail" },
      { property: "og:description", content: "Create a multi-step email campaign." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewCampaign,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function NewCampaign() {
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(wizardDataQuery);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [listId, setListId] = useState("");
  const [configId, setConfigId] = useState("");
  const [steps, setSteps] = useState<{ template_id: string; delay_days: number }[]>([
    { template_id: "", delay_days: 0 },
  ]);
  const [sendDays, setSendDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [windowStart, setWindowStart] = useState("09:00");
  const [windowEnd, setWindowEnd] = useState("17:00");
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
      const campaign = await createCampaign({
        data: {
          name: name.trim(),
          list_id: listId,
          config_id: configId,
          steps: steps.map((s, i) => ({ ...s, step_order: i + 1 })),
          send_window_start: windowStart,
          send_window_end: windowEnd,
          send_days: sendDays,
        },
      });
      toast.success("Campaign created — start it from the campaigns page");
      navigate({ to: "/campaigns/$campaignId", params: { campaignId: campaign.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setSaving(false);
    }
  };

  const stepTitles = ["Basics", "Email sequence", "Schedule"];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New campaign</h1>
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
            {saving ? "Creating…" : "Create campaign"}
          </Button>
        )}
      </div>
    </div>
  );
}
