import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getCrmClient, updateDeal, deleteDeal, addNote, updateNote, deleteNote } from "@/lib/crm.functions";
import { stageColor, fmtMoney } from "@/lib/crm-colors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Bell, Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const clientQuery = (id: string) => queryOptions({ queryKey: ["crm-client", id], queryFn: () => getCrmClient({ data: { contact_id: id } }) });

export const Route = createFileRoute("/_authenticated/crm/clients/$contactId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(clientQuery(params.contactId)),
  head: () => ({
    meta: [
      { title: "Client | AceMail CRM" },
      { name: "description", content: "Client profile with deals, notes, reminders and full outreach history." },
      { property: "og:title", content: "Client | AceMail CRM" },
      { property: "og:description", content: "Client profile with deals, notes, reminders and full outreach history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CrmClientPage,
});

function CrmClientPage() {
  const { contactId } = Route.useParams();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(clientQuery(contactId));
  const { contact: c, stages, deals, notes } = data;
  const refresh = () => qc.invalidateQueries({ queryKey: ["crm-client", contactId] });
  const stageById = new Map(stages.map((s) => [s.id, s]));

  const [noteBody, setNoteBody] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [busy, setBusy] = useState(false);

  const timeline = [
    ...data.logs.map((l) => ({
      at: l.sent_at ?? l.scheduled_at,
      kind: "Email",
      text: `${l.direct_subject ?? "Email"}${(l.campaigns as { name: string } | null) ? ` · ${(l.campaigns as { name: string }).name}` : ""}`,
      status: l.status,
    })),
    ...data.replies.map((r) => ({ at: r.received_at, kind: r.is_auto_reply ? "Out of office" : "Reply", text: `${r.subject} · ${r.snippet}`, status: "received" })),
    ...data.tasks.map((t) => ({
      at: t.completed_at ?? t.due_at,
      kind: "LinkedIn",
      text: `${t.action}${(t.linkedin_sequences as { name: string } | null) ? ` · ${(t.linkedin_sequences as { name: string }).name}` : ""}`,
      status: t.status,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const submitNote = async () => {
    if (!noteBody.trim()) return;
    setBusy(true);
    try {
      await addNote({ data: { contact_id: contactId, deal_id: null, body: noteBody.trim(), remind_at: remindAt ? new Date(remindAt).toISOString() : null } });
      setNoteBody("");
      setRemindAt("");
      toast.success(remindAt ? "Reminder saved" : "Note saved");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save note");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/crm/clients" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Client board
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{`${c.first_name} ${c.last_name}`.trim() || c.email}</h1>
        <p className="text-sm text-muted-foreground">
          {c.email}{c.company ? ` · ${c.company}` : ""}{c.title ? ` · ${c.title}` : ""} · {(c.contact_lists as { name: string } | null)?.name}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Deals</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {deals.length === 0 && <p className="text-sm text-muted-foreground">No deals yet. Add one from the pipeline board.</p>}
            {deals.map((d) => {
              const stage = stageById.get(d.stage_id);
              return (
                <div key={d.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">{d.title || "Deal"}</p>
                    <span className="text-sm font-semibold">{Number(d.value) > 0 ? fmtMoney(Number(d.value), d.currency) : "—"}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Delete deal"
                      onClick={async () => {
                        try {
                          await deleteDeal({ data: { id: d.id } });
                          refresh();
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Could not delete");
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={d.stage_id}
                      onValueChange={async (stage_id) => {
                        try {
                          await updateDeal({ data: { id: d.id, stage_id } });
                          refresh();
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Could not move deal");
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${stageColor(s.color).dot}`} />{s.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {stage && <Badge variant="outline">{stage.name}</Badge>}
                    {d.expected_close && <span className="text-xs text-muted-foreground">closes {new Date(d.expected_close).toLocaleDateString()}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      defaultValue={Number(d.value) || ""}
                      placeholder="Value"
                      className="h-8 w-28"
                      onBlur={async (e) => {
                        const value = Number(e.target.value) || 0;
                        if (value !== Number(d.value)) {
                          try {
                            await updateDeal({ data: { id: d.id, value } });
                            refresh();
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Could not update value");
                          }
                        }
                      }}
                    />
                    <Input
                      type="date"
                      defaultValue={d.expected_close ?? ""}
                      className="h-8 w-40"
                      onBlur={async (e) => {
                        const expected_close = e.target.value || null;
                        if (expected_close !== d.expected_close) {
                          try {
                            await updateDeal({ data: { id: d.id, expected_close } });
                            refresh();
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Could not update date");
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Notes & reminders</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Write a note or reminder…" rows={2} />
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Remind me</Label>
                <Input type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} className="h-8 w-auto" />
                <Button size="sm" className="ml-auto h-8" disabled={busy || !noteBody.trim()} onClick={() => void submitNote()}>
                  <Plus className="mr-1 h-4 w-4" /> Save
                </Button>
              </div>
            </div>
            <div className="divide-y">
              {notes.length === 0 && <p className="py-3 text-sm text-muted-foreground">No notes yet.</p>}
              {notes.map((n) => (
                <div key={n.id} className={`flex items-start gap-2 py-2.5 ${n.done ? "opacity-50" : ""}`}>
                  <button
                    className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={n.done ? "Mark not done" : "Mark done"}
                    onClick={async () => {
                      try {
                        await updateNote({ data: { id: n.id, done: !n.done } });
                        refresh();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Could not update");
                      }
                    }}
                  >
                    <Check className={`h-4 w-4 ${n.done ? "text-green-500" : ""}`} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${n.done ? "line-through" : ""}`}>{n.body}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(n.created_at).toLocaleDateString()}
                      {n.remind_at && (
                        <span className="ml-2 inline-flex items-center gap-1">
                          <Bell className="h-3 w-3" />
                          {new Date(n.remind_at).toLocaleString()}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="Delete note"
                    onClick={async () => {
                      try {
                        await deleteNote({ data: { id: n.id } });
                        refresh();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Could not delete");
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
        <CardContent className="divide-y p-0">
          {timeline.length === 0 && <p className="p-6 text-sm text-muted-foreground">No outreach yet.</p>}
          {timeline.map((t, i) => (
            <div key={i} className="flex items-start gap-3 px-6 py-3">
              <Badge variant="outline" className="shrink-0">{t.kind}</Badge>
              <p className="min-w-0 flex-1 truncate text-sm">{t.text}</p>
              <Badge variant={t.status === "bounced" || t.status === "failed" ? "destructive" : "secondary"} className="shrink-0">{t.status}</Badge>
              <span className="shrink-0 text-xs text-muted-foreground">{new Date(t.at).toLocaleDateString()}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
