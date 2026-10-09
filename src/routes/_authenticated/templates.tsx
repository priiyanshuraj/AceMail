import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listTemplates, saveTemplate, deleteTemplate, listCustomFieldKeys, listPreviewContacts } from "@/lib/acemail.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Mail, UserRound } from "lucide-react";
import { toast } from "sonner";

const templatesQuery = queryOptions({
  queryKey: ["templates"],
  queryFn: () => listTemplates(),
});

const previewContactsQuery = queryOptions({
  queryKey: ["preview-contacts"],
  queryFn: () => listPreviewContacts(),
});

export const Route = createFileRoute("/_authenticated/templates")({
  loader: ({ context }) => context.queryClient.ensureQueryData(templatesQuery),
  head: () => ({
    meta: [
      { title: "Templates — AceMail" },
      { name: "description", content: "Design personalized email templates." },
      { property: "og:title", content: "Templates — AceMail" },
      { property: "og:description", content: "Design personalized email templates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TemplatesPage,
});

type Template = Awaited<ReturnType<typeof listTemplates>>[number];

const VARIABLES = ["{{first_name}}", "{{last_name}}", "{{company}}", "{{email}}"];

function TemplatesPage() {
  const queryClient = useQueryClient();
  const { data: templates } = useSuspenseQuery(templatesQuery);
  const [editing, setEditing] = useState<Partial<Template> | null>(null);
  const [previewContactId, setPreviewContactId] = useState<string>("sample");
  const { data: customKeys } = useQuery({ queryKey: ["custom-field-keys"], queryFn: () => listCustomFieldKeys() });
  const { data: previewContacts } = useQuery({ queryKey: ["preview-contacts"], queryFn: () => listPreviewContacts() });
  const allVars = [...VARIABLES, ...(customKeys ?? []).map((k) => `{{${k}}}`)];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["templates"] });

  const handleSave = async () => {
    if (!editing?.name) {
      toast.error("Give the template a name");
      return;
    }
    await saveTemplate({
      data: {
        id: editing.id,
        name: editing.name,
        subject: editing.subject ?? "",
        body: editing.body ?? "",
      },
    });
    setEditing(null);
    refresh();
    toast.success("Template saved");
  };

  const preview = (text: string) =>
    text
      .replaceAll("{{first_name}}", "Jane")
      .replaceAll("{{last_name}}", "Doe")
      .replaceAll("{{company}}", "Acme Inc")
      .replaceAll("{{email}}", "jane@acme.com")
      .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k: string) => `[${k}]`);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Templates</h1>
          <p className="text-sm text-muted-foreground">Reusable emails with personalization variables</p>
        </div>
        <Button onClick={() => setEditing({ name: "", subject: "", body: "" })}>
          <Plus className="mr-2 h-4 w-4" /> New template
        </Button>
      </div>

      {editing ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{editing.id ? "Edit template" : "New template"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Intro email"
                />
              </div>
              <div className="space-y-1">
                <Label>Subject</Label>
                <Input
                  value={editing.subject ?? ""}
                  onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                  placeholder="Quick question, {{first_name}}"
                />
              </div>
              <div className="space-y-1">
                <Label>Body</Label>
                <Textarea
                  rows={12}
                  value={editing.body ?? ""}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                  placeholder={"Hi {{first_name}},\n\nI noticed {{company}} is…"}
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {allVars.map((v) => (
                  <Badge
                    key={v}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => setEditing({ ...editing, body: (editing.body ?? "") + v })}
                  >
                    {v}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave}>Save template</Button>
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="mb-2 border-b pb-2 text-sm font-semibold">
                  {preview(editing.subject ?? "") || "(no subject)"}
                </p>
                <div className="whitespace-pre-wrap text-sm">{preview(editing.body ?? "") || "(no body)"}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.length === 0 && (
            <Card className="md:col-span-2 lg:col-span-3">
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <Mail className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No templates yet — create your first one.</p>
              </CardContent>
            </Card>
          )}
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{t.subject || "(no subject)"}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      await deleteTemplate({ data: { id: t.id } });
                      refresh();
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{t.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
