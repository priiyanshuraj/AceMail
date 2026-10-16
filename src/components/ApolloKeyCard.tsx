import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getApolloStatus, setApolloKey } from "@/lib/outreach.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ApolloKeyCard() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["apollo-status"], queryFn: () => getApolloStatus() });
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (value: string) => {
    setBusy(true);
    try {
      await setApolloKey({ data: { key: value } });
      setKey("");
      qc.invalidateQueries({ queryKey: ["apollo-status"] });
      toast.success(value ? "Apollo key saved" : "Apollo key removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally { setBusy(false); }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Apollo email finder</CardTitle>
        <CardDescription>
          Paste your own Apollo.io API key to fill in missing job titles, companies, LinkedIn profiles and emails for your contacts.
          Each lookup uses your Apollo credits. The key is stored encrypted and never shown again.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data?.hint && <p className="text-sm">Connected key ending in <span className="font-mono">…{data.hint}</span></p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input type="password" placeholder="Apollo API key" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
          <Button disabled={busy || !key.trim()} onClick={() => save(key.trim())}>Save key</Button>
          {data?.hint && <Button variant="outline" disabled={busy} onClick={() => save("")}>Remove</Button>}
        </div>
      </CardContent>
    </Card>
  );
}
