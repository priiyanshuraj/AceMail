import { useEffect, useState } from "react";
import {
  getSheetsStatus,
  startSheetsConnect,
  completeSheetsConnect,
  listMySpreadsheets,
  getSpreadsheetTabs,
  getSheetRows,
} from "@/lib/sheets.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileSpreadsheet, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

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
        event.data?.connectorId !== "google_sheets" ||
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

function extractId(input: string) {
  const m = input.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(input.trim()) ? input.trim() : null;
}

type DriveFile = { id: string; name: string; modifiedTime?: string };

export function GoogleSheetImport({ onRows }: { onRows: (rows: string[][]) => void }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [link, setLink] = useState("");
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [sheetName, setSheetName] = useState("");
  const [tabs, setTabs] = useState<string[]>([]);
  const [tab, setTab] = useState("");

  const loadFiles = async (q?: string) => {
    setListLoading(true);
    try {
      const r = await listMySpreadsheets({ data: { search: q } });
      if (r.reconnect) {
        setConnected(false);
        return;
      }
      setFiles(r.files);
      setListError(r.error);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    getSheetsStatus()
      .then((s) => setConnected(s.connected))
      .catch(() => setConnected(false));
  }, []);

  const connect = async () => {
    const popup = window.open("", "acemail-sheets", "width=600,height=720");
    if (!popup) { toast.error("Popup blocked. Allow popups and try again."); return; }
    setBusy(true);
    try {
      const res = await startSheetsConnect();
      const done = waitForOAuth(popup);
      popup.location.href = res.authorizationUrl;
      const code = await done;
      if (!code) throw new Error("Google did not grant ongoing access. Please try again.");
      await completeSheetsConnect({ data: { code, appUserId: res.appUserId } });
      setConnected(true);
      setListError(null);
      toast.success("Google Sheets connected");
      setPickerOpen(true);
      await loadFiles();
    } catch (e) {
      popup.close();
      toast.error(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setBusy(false);
    }
  };

  const openPicker = async () => {
    setPickerOpen(true);
    setSearch("");
    await loadFiles();
  };

  const pickSheet = async (id: string, name?: string) => {
    setBusy(true);
    try {
      const r = await getSpreadsheetTabs({ data: { spreadsheetId: id } });
      setSheetId(id);
      setSheetName(name ?? r.title ?? "");
      setTabs(r.tabs);
      setTab(r.tabs[0] ?? "");
      setPickerOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open that sheet");
    } finally {
      setBusy(false);
    }
  };

  const loadRows = async () => {
    if (!sheetId || !tab) return;
    setBusy(true);
    try {
      const r = await getSheetRows({ data: { spreadsheetId: sheetId, tab } });
      if (r.rows.length < 2) { toast.error("That tab needs a header row and at least one contact"); return; }
      onRows(r.rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that tab");
    } finally {
      setBusy(false);
    }
  };

  if (connected === null) return null;

  if (!connected)
    return (
      <Button variant="outline" className="w-full" onClick={connect} disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
        Import from Google Sheets
      </Button>
    );

  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label className="flex items-center gap-2">
        <FileSpreadsheet className="h-4 w-4" /> Google Sheet
      </Label>
      <Button variant="outline" className="w-full" onClick={openPicker} disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
        Browse your Drive
      </Button>
      {listError && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Couldn't list your sheets — reconnect Google or paste a link.</p>
          <Button size="sm" variant="ghost" onClick={connect} disabled={busy}>
            <RefreshCw className="mr-1 h-3 w-3" /> Reconnect
          </Button>
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="…or paste a Google Sheets link"
          className="h-9"
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            const id = extractId(link);
            if (!id) { toast.error("That doesn't look like a Google Sheets link"); return; }
            void pickSheet(id);
          }}
        >
          Open
        </Button>
      </div>
      {sheetId && tabs.length > 0 && (
        <div className="flex gap-2">
          <Select value={tab} onValueChange={setTab}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Tab" /></SelectTrigger>
            <SelectContent>
              {tabs.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={loadRows} disabled={busy || !tab}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Load columns
          </Button>
        </div>
      )}
      {sheetId && sheetName && (
        <p className="text-xs text-muted-foreground">Selected: {sheetName}</p>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pick a sheet from your Drive</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your sheets…"
              className="h-9"
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadFiles(search);
              }}
            />
            <Button size="sm" variant="secondary" onClick={() => void loadFiles(search)} disabled={listLoading}>
              {listLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto rounded-md border">
            {listLoading && files.length === 0 && (
              <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your sheets…
              </div>
            )}
            {!listLoading && files.length === 0 && !listError && (
              <p className="p-8 text-center text-sm text-muted-foreground">No spreadsheets found.</p>
            )}
            {listError && (
              <div className="space-y-2 p-8 text-center">
                <p className="text-sm text-muted-foreground">Couldn't list your sheets.</p>
                <Button size="sm" variant="outline" onClick={connect} disabled={busy}>
                  <RefreshCw className="mr-1 h-3 w-3" /> Reconnect Google
                </Button>
              </div>
            )}
            {files.map((f) => (
              <button
                key={f.id}
                type="button"
                className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-accent"
                onClick={() => void pickSheet(f.id, f.name)}
                disabled={busy}
              >
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{f.name}</span>
                  {f.modifiedTime && (
                    <span className="block text-xs text-muted-foreground">
                      Edited {new Date(f.modifiedTime).toLocaleDateString()}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
