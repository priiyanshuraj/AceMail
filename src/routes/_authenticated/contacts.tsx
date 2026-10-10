import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listContactLists,
  createContactList,
  deleteContactList,
  listContacts,
  importContacts,
  deleteContact,
  listCustomFieldKeys,
} from "@/lib/acemail.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Minus, Upload, Trash2, Users, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { GoogleSheetImport } from "@/components/GoogleSheetImport";

function slug(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64);
}

/** Minimal quote-aware CSV parser (comma or tab). */
function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  if (!text.trim()) return out;
  const first = text.split("\n")[0] ?? "";
  const delim = first.includes("\t") && !first.includes(",") ? "\t" : ",";
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((c) => c.trim())) out.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim())) out.push(row);
  return out;
}

const listsQuery = queryOptions({
  queryKey: ["contact-lists"],
  queryFn: () => listContactLists(),
});

export const Route = createFileRoute("/_authenticated/contacts")({
  loader: ({ context }) => context.queryClient.ensureQueryData(listsQuery),
  head: () => ({
    meta: [
      { title: "Contacts — AceMail" },
      { name: "description", content: "Manage contact lists and imports." },
      { property: "og:title", content: "Contacts — AceMail" },
      { property: "og:description", content: "Manage contact lists and imports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactsPage,
});

function ContactsPage() {
  const queryClient = useQueryClient();
  const { data: lists } = useSuspenseQuery(listsQuery);
  const [selectedList, setSelectedList] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [contacts, setContacts] = useState<Awaited<ReturnType<typeof listContacts>>>([]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["contact-lists"] });

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    await createContactList({ data: { name: newListName.trim() } });
    setNewListName("");
    setListDialogOpen(false);
    refresh();
    toast.success("List created");
  };

  const handleSelectList = async (id: string) => {
    setSelectedList(id);
    setContacts(await listContacts({ data: { listId: id } }));
  };

  const [customKeys, setCustomKeys] = useState<string[]>([]);
  const [mapping, setMapping] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [newFieldCol, setNewFieldCol] = useState<number | null>(null);
  const [newFieldName, setNewFieldName] = useState("");
  const [emptyCols, setEmptyCols] = useState<Set<number>>(new Set());

  const excludeCol = (i: number) => {
    setMapping((m) => m.map((x, j) => (j === i ? "skip" : x)));
    setExcluded((s) => new Set(s).add(i));
  };
  const includeCol = (i: number) => {
    setExcluded((s) => {
      const n = new Set(s);
      n.delete(i);
      return n;
    });
  };

  const rows = parseCsv(csvText);
  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1);

  const autoMap = (hdrs: string[], keys: string[]) =>
    hdrs.map((h) => {
      const n = slug(h);
      if (/^e?_?mail(_address)?$/.test(n)) return "email";
      if (["first_name", "firstname", "first"].includes(n)) return "first_name";
      if (["last_name", "lastname", "last", "surname"].includes(n)) return "last_name";
      if (["company", "company_name", "organization", "organisation"].includes(n)) return "company";
      if (keys.includes(n)) return `custom:${n}`;
      return n ? `custom:${n}` : "skip";
    });

  const loadCsv = async (text: string) => {
    setCsvText(text);
    setExcluded(new Set());
    const keys = await listCustomFieldKeys().catch(() => [] as string[]);
    const parsed = parseCsv(text);
    const hdrs = parsed[0] ?? [];
    const data = parsed.slice(1);
    const empty = new Set<number>();
    hdrs.forEach((_, i) => {
      if (data.every((r) => !(r[i] ?? "").trim())) empty.add(i);
    });
    setEmptyCols(empty);
    const mapped = autoMap(hdrs, keys).map((m, i) => (empty.has(i) ? "skip" : m));
    setCustomKeys([...new Set([...keys, ...mapped.filter((m) => m.startsWith("custom:")).map((m) => m.slice(7))])].sort());
    setMapping(mapped);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => void loadCsv(String(reader.result ?? ""));
    reader.readAsText(file);
    e.target.value = "";
  };

  const setMap = (i: number, v: string) => {
    if (v === "__new") {
      setNewFieldCol(i);
      setNewFieldName(slug(headers[i] ?? ""));
      return;
    }
    setMapping((m) => m.map((x, j) => (j === i ? v : x)));
  };

  const confirmNewField = () => {
    const key = slug(newFieldName);
    if (!key || newFieldCol === null) return;
    setCustomKeys((k) => [...new Set([...k, key])].sort());
    setMapping((m) => m.map((x, j) => (j === newFieldCol ? `custom:${key}` : x)));
    setNewFieldCol(null);
  };

  const handleImport = async () => {
    if (!selectedList) return;
    const emailCol = mapping.indexOf("email");
    if (emailCol < 0) {
      toast.error("Map one column to Email");
      return;
    }
    const parsed = dataRows
      .map((r) => {
        const c: { email: string; first_name?: string; last_name?: string; company?: string; custom_fields: Record<string, string> } = { email: "", custom_fields: {} };
        mapping.forEach((m, i) => {
          const val = (r[i] ?? "").trim();
          if (m === "skip" || !val) return;
          if (m.startsWith("custom:")) c.custom_fields[m.slice(7)] = val;
          else (c as unknown as Record<string, string>)[m] = val;
        });
        return c;
      })
      .filter((r) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email));
    if (parsed.length === 0) {
      toast.error("No valid emails found");
      return;
    }
    try {
      const result = await importContacts({ data: { listId: selectedList, contacts: parsed } });
      toast.success(`Imported ${result.imported} contacts`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
      return;
    }
    setCsvText("");
    setMapping([]);
    setImportDialogOpen(false);
    setContacts(await listContacts({ data: { listId: selectedList } }));
    refresh();
  };

  const handleDeleteContact = async (id: string) => {
    await deleteContact({ data: { id } });
    if (selectedList) setContacts(await listContacts({ data: { listId: selectedList } }));
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-sm text-muted-foreground">Organize and import your contact lists</p>
        </div>
        <Dialog open={listDialogOpen} onOpenChange={setListDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New list
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create contact list</DialogTitle>
              <DialogDescription>Group contacts you want to target together.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label htmlFor="list-name">List name</Label>
              <Input
                id="list-name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Q4 prospects"
              />
              <Button onClick={handleCreateList} className="w-full">
                Create list
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-2">
          {lists.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                <Users className="mx-auto mb-2 h-6 w-6" />
                No lists yet — create one to get started.
              </CardContent>
            </Card>
          )}
          {lists.map((list) => (
            <Card
              key={list.id}
              className={`cursor-pointer transition-colors ${
                selectedList === list.id ? "border-primary" : "hover:border-accent"
              }`}
              onClick={() => handleSelectList(list.id)}
            >
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{list.name}</p>
                  <p className="text-xs text-muted-foreground">{list.contact_count} contacts</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await deleteContactList({ data: { id: list.id } });
                    if (selectedList === list.id) setSelectedList(null);
                    refresh();
                  }}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-2">
          {selectedList ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Contacts</CardTitle>
                <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Upload className="mr-2 h-4 w-4" /> Import CSV
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Import contacts</DialogTitle>
                      <DialogDescription>
                        Upload a CSV with a header row. Map each column to a field — any extra column can become a custom field you use in templates as {"{{field_name}}"}.
                      </DialogDescription>
                    </DialogHeader>
                    {headers.length === 0 && (
                      <GoogleSheetImport
                        onRows={(r) =>
                          void loadCsv(
                            r.map((row) => row.map((c) => (/[",\n\r]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n"),
                          )
                        }
                      />
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="csv-file">CSV file</Label>
                      <Input id="csv-file" type="file" accept=".csv,text/csv,text/plain" onChange={handleFileUpload} />
                    </div>
                    {headers.length === 0 ? (
                      <Textarea
                        rows={6}
                        value={csvText}
                        onChange={(e) => void loadCsv(e.target.value)}
                        placeholder={"…or paste CSV here\nemail,first_name,company,city\njane@acme.com,Jane,Acme Inc,Berlin"}
                      />
                    ) : (
                      <div className="max-h-[45vh] space-y-2 overflow-y-auto rounded-md border p-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {dataRows.length} rows · {headers.length - emptyCols.size} columns
                            {emptyCols.size > 0 && ` (${emptyCols.size} empty hidden)`}
                          </span>
                          <button className="underline" onClick={() => { setCsvText(""); setMapping([]); setExcluded(new Set()); setEmptyCols(new Set()); }}>
                            Clear
                          </button>
                        </div>
                        {headers.map((h, i) => (!emptyCols.has(i) && (
                          <div key={i} className={`grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 ${excluded.has(i) ? "opacity-50" : ""}`}>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{h || `Column ${i + 1}`}</p>
                              <p className="truncate text-xs text-muted-foreground">{dataRows[0]?.[i] || "—"}</p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            {excluded.has(i) ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">Not included</span>
                                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Include column ${h || i + 1}`} onClick={() => includeCol(i)}>
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : newFieldCol === i ? (
                              <div className="flex gap-1">
                                <Input
                                  autoFocus
                                  value={newFieldName}
                                  onChange={(e) => setNewFieldName(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && confirmNewField()}
                                  placeholder="field_name"
                                  className="h-9"
                                />
                                <Button size="sm" onClick={confirmNewField}>Add</Button>
                              </div>
                            ) : (
                              <Select value={mapping[i] ?? "skip"} onValueChange={(v) => setMap(i, v)}>
                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="skip">Don't import</SelectItem>
                                  <SelectItem value="email">Email</SelectItem>
                                  <SelectItem value="first_name">First name</SelectItem>
                                  <SelectItem value="last_name">Last name</SelectItem>
                                  <SelectItem value="company">Company</SelectItem>
                                  {customKeys.map((k) => (
                                    <SelectItem key={k} value={`custom:${k}`}>{`{{${k}}}`}</SelectItem>
                                  ))}
                                  <SelectItem value="__new">+ Create custom field…</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            {!excluded.has(i) && newFieldCol !== i && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Exclude column ${h || i + 1}`} onClick={() => excludeCol(i)}>
                                <Minus className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            )}
                            {(excluded.has(i) || newFieldCol === i) && <span className="w-7" />}
                          </div>
                        ))}
                      </div>
                    )}
                    <Button onClick={handleImport} className="w-full" disabled={headers.length === 0}>
                      Import {dataRows.length > 0 ? `${dataRows.length} contacts` : ""}
                    </Button>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.email}</TableCell>
                        <TableCell>{[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}</TableCell>
                        <TableCell>{c.company || "—"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteContact(c.id)}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {contacts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No contacts in this list yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Select a list to view its contacts.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
