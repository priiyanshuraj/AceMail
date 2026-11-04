import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getIsAdmin, listAiUsers, updateAiDefaults, updateUserAiLimit } from "@/lib/admin.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin controls | AceMail" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

type U = Awaited<ReturnType<typeof listAiUsers>>["users"][number];

function AdminPage() {
  const role = useQuery({ queryKey: ["is-admin"], queryFn: () => getIsAdmin() });
  const list = useQuery({ queryKey: ["admin-ai-users"], queryFn: () => listAiUsers(), enabled: role.data?.admin === true });
  const qc = useQueryClient();
  const [def, setDef] = useState({ email: "20", linkedin: "20" });
  useEffect(() => {
    if (list.data) setDef({ email: String(list.data.defaults.email), linkedin: String(list.data.defaults.linkedin) });
  }, [list.data]);

  if (role.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!role.data?.admin) return <p className="text-muted-foreground">Only admins can see this page.</p>;

  const saveDefaults = async () => {
    try {
      await updateAiDefaults({ data: { email: Number(def.email) || 0, linkedin: Number(def.linkedin) || 0 } });
      toast.success("Default daily limits saved");
      void qc.invalidateQueries({ queryKey: ["admin-ai-users"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Free AI daily limits</CardTitle>
          <CardDescription>How many AI cold emails and LinkedIn messages each user can generate per day with the free AI. People using their own AI key or MCP are not limited.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">Emails per day<Input type="number" min={0} className="w-32" value={def.email} onChange={(e) => setDef({ ...def, email: e.target.value })} /></label>
          <label className="space-y-1 text-sm">LinkedIn messages per day<Input type="number" min={0} className="w-32" value={def.linkedin} onChange={(e) => setDef({ ...def, linkedin: e.target.value })} /></label>
          <Button onClick={() => void saveDefaults()}>Save defaults</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Turn free AI on or off per person, or give someone a custom limit. Leave a limit empty to use the default.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {list.isLoading && <p className="text-muted-foreground">Loading users…</p>}
          {list.data?.users.map((u) => <UserRow key={u.id} u={u} defaults={list.data.defaults} />)}
        </CardContent>
      </Card>
    </div>
  );
}

function UserRow({ u, defaults }: { u: U; defaults: { email: number; linkedin: number } }) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(u.enabled);
  const [email, setEmail] = useState(u.emailLimit?.toString() ?? "");
  const [li, setLi] = useState(u.linkedinLimit?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const save = async (on = enabled) => {
    setBusy(true);
    try {
      await updateUserAiLimit({ data: { userId: u.id, enabled: on, emailLimit: email === "" ? null : Number(email), linkedinLimit: li === "" ? null : Number(li) } });
      toast.success(`Saved for ${u.email}`);
      void qc.invalidateQueries({ queryKey: ["admin-ai-users"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
      <div className="min-w-[200px] flex-1">
        <p className="font-medium break-all">{u.email}</p>
        <p className="text-xs text-muted-foreground">Today: {u.emailsUsed} emails, {u.linkedinUsed} LinkedIn</p>
      </div>
      <label className="flex items-center gap-2 text-sm"><Switch checked={enabled} onCheckedChange={(v) => { setEnabled(v); void save(v); }} /> Free AI</label>
      <Input type="number" min={0} className="w-28" placeholder={`${defaults.email} emails`} value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input type="number" min={0} className="w-28" placeholder={`${defaults.linkedin} LinkedIn`} value={li} onChange={(e) => setLi(e.target.value)} />
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void save()}>Save</Button>
    </div>
  );
}
