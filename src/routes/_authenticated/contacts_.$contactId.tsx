import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getContactDetail, updateContactProfile, enrichContact } from "@/lib/outreach.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";

const detailQuery = (id: string) => queryOptions({ queryKey: ["contact", id], queryFn: () => getContactDetail({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/contacts_/$contactId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(detailQuery(params.contactId)),
  head: () => ({
    meta: [
      { title: "Contact | AceMail" },
      { name: "description", content: "Contact profile with full email and LinkedIn outreach history." },
      { property: "og:title", content: "Contact | AceMail" },
      { property: "og:description", content: "Contact profile with full email and LinkedIn outreach history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { contactId } = Route.useParams();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(detailQuery(contactId));
  const c = data.contact;
  const [f, setF] = useState({ first_name: c.first_name, last_name: c.last_name, company: c.company, title: c.title, phone: c.phone, linkedin_url: c.linkedin_url });
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["contact", contactId] });
  const custom = Object.entries((c.custom_fields ?? {}) as Record<string, unknown>).filter(([, v]) => v !== "" && v != null);

  const timeline = [
    ...data.logs.map((l) => ({ at: l.sent_at ?? l.scheduled_at, kind: "Email", text: `${(l.email_templates as { subject: string } | null)?.subject ?? "Email"}${(l.campaigns as { name: string } | null) ? ` · ${(l.campaigns as { name: string }).name}` : ""}`, status: l.status })),
    ...data.replies.map((r) => ({ at: r.received_at, kind: r.is_auto_reply ? "Out of office" : "Reply", text: `${r.subject} · ${r.snippet}`, status: "received" })),
    ...data.tasks.map((t) => ({ at: t.completed_at ?? t.due_at, kind: "LinkedIn", text: `${t.action}${(t.linkedin_sequences as { name: string } | null) ? ` · ${(t.linkedin_sequences as { name: string }).name}` : ""}`, status: t.status })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="space-y-6">
      <Link to="/contacts" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-1 h-4 w-4" /> Contacts</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{`${c.first_name} ${c.last_name}`.trim() || c.email}</h1>
          <p className="text-sm text-muted-foreground">{c.email} · {(c.contact_lists as { name: string } | null)?.name}{c.unsubscribed ? " · unsubscribed" : ""}</p>
        </div>
        <div className="flex gap-2">
          {c.linkedin_url && <Button variant="outline" asChild><a href={c.linkedin_url} target="_blank" rel="noreferrer noopener"><ExternalLink className="mr-2 h-4 w-4" /> LinkedIn</a></Button>}
          <Button variant="outline" disabled={busy} onClick={async () => {
            setBusy(true);
            try { const r = await enrichContact({ data: { id: contactId } }); toast.success(r.matched ? "Profile filled in from Apollo" : "Apollo found no match"); refresh(); }
            catch (e) { toast.error(e instanceof Error ? e.message : "Enrichment failed"); }
            finally { setBusy(false); }
          }}><Sparkles className="mr-2 h-4 w-4" /> Find with Apollo</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(["first_name", "last_name", "company", "title", "phone", "linkedin_url"] as const).map((k) => (
              <div key={k} className="space-y-1">
                <Label className="capitalize">{k === "linkedin_url" ? "LinkedIn profile" : k.replace("_", " ")}</Label>
                <Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={k === "linkedin_url" ? "https://www.linkedin.com/in/..." : ""} />
              </div>
            ))}
            <Button disabled={busy} onClick={async () => {
              try { await updateContactProfile({ data: { id: contactId, ...f } }); toast.success("Saved"); refresh(); }
              catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
            }}>Save</Button>
            {c.enriched_at && <p className="text-xs text-muted-foreground">Checked with Apollo {new Date(c.enriched_at).toLocaleDateString()}</p>}
            {custom.length > 0 && (
              <div className="space-y-1 border-t pt-3">
                <p className="eyebrow">Imported fields</p>
                {custom.map(([k, v]) => <p key={k} className="text-sm"><span className="text-muted-foreground">{k}:</span> <span className="break-words">{String(v)}</span></p>)}
              </div>
            )}
          </CardContent>
        </Card>
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
    </div>
  );
}
