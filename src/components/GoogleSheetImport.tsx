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
import { FileSpreadsheet, Loader2 } from "lucide-react";
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

export function GoogleSheetImport({ onRows }: { onRows: (rows: string[][]) => void }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<{ id: string; name: string }[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [tabs, setTabs] = useState<string[]>([]);
  const [tab, setTab] = useState("");

  const loadFiles = async () => {
    const r = await listMySpreadsheets();
    if (r.reconnect) return setConnected(false);
    setFiles(r.files);
    setListError(r.error);
  };

  useEffect(() => {
    getSheetsStatus()
      .then((s) => {
        setConnected(s.connected);
        if (s.connected) void loadFiles();
      })
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
      toast.success("Google Sheets connected");
      await loadFiles();
    } catch (e) {
      popup.close();
      toast.error(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setBusy(false);
    }
  };

  const pickSheet = async (id: string) => {
    setBusy(true);
    try {
      const r = await getSpreadsheetTabs({ data: { spreadsheetId: id } });
      setSheetId(id);
      setTabs(r.tabs);
      setTab(r.tabs[0] ?? "");
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
      {files.length > 0 && (
        <Select value={sheetId ?? ""} onValueChange={(v) => void pickSheet(v)}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Pick a sheet from your Drive" /></SelectTrigger>
          <SelectContent>
            {files.map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {listError && <p className="text-xs text-muted-foreground">Couldn't list your sheets — paste a link instead.</p>}
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
    </div>
  );
}
