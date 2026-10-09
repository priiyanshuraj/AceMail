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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Upload, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

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

  const handleImport = async () => {
    if (!selectedList) return;
    const lines = csvText.split("\n").map((l) => l.trim()).filter(Boolean);
    const parsed = lines
      .map((line) => {
        const [email, first_name, last_name, company] = line.split(/[,\t]/).map((s) => s?.trim() ?? "");
        return { email, first_name, last_name, company };
      })
      .filter((r) => r.email?.includes("@"));
    if (parsed.length === 0) {
      toast.error("No valid emails found. Format: email, first name, last name, company");
      return;
    }
    const result = await importContacts({ data: { listId: selectedList, contacts: parsed } });
    toast.success(`Imported ${result.imported} contacts`);
    setCsvText("");
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
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Import contacts</DialogTitle>
                      <DialogDescription>
                        Paste one contact per line: email, first name, last name, company
                      </DialogDescription>
                    </DialogHeader>
                    <Textarea
                      rows={8}
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                      placeholder={"jane@acme.com, Jane, Doe, Acme Inc\njohn@corp.io, John, Smith, Corp"}
                    />
                    <Button onClick={handleImport} className="w-full">
                      Import
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
