import { useState } from "react";
import { Wand2, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAiQuota, personalizeContacts } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export function AiPersonalizeButton({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"email" | "linkedin">("email");
  const [instructions, setInstructions] = useState("");
  const [progress, setProgress] = useState<{ done: number; failed: number } | null>(null);
  const quota = useQuery({ queryKey: ["ai-quota"], queryFn: () => getAiQuota(), enabled: open });

  const q = quota.data;
  const left = q ? (kind === "email" ? q.emailLimit - q.emailsUsed : q.linkedinLimit - q.linkedinUsed) : null;

  const run = async () => {
    let done = 0, failed = 0;
    setProgress({ done, failed });
    try {
      for (let i = 0; i < ids.length; i += 5) {
        const { results } = await personalizeContacts({ data: { ids: ids.slice(i, i + 5), instructions, kind } });
        done += results.filter((r) => r.ok).length;
        const bad = results.filter((r) => !r.ok);
        failed += bad.length;
        setProgress({ done, failed });
        const stop = bad.find((b) => b.error?.includes("today's free AI") || b.error?.includes("turned off"));
        if (stop) { if (done) toast.success(`Wrote ${done} message${done === 1 ? "" : "s"}`); throw new Error(stop.error); }
        if (bad.length === results.length && bad[0]?.error) throw new Error(bad[0].error);
      }
      toast.success(`Wrote personalised ${kind === "email" ? "emails" : "LinkedIn messages"} for ${done} lead${done === 1 ? "" : "s"}`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI writing failed", { duration: 10000 });
    } finally {
      setProgress(null);
      void quota.refetch();
      onDone();
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" disabled={!ids.length} onClick={() => setOpen(true)}>
        <Wand2 className="mr-2 h-4 w-4" /> AI personalise{ids.length ? ` (${ids.length})` : ""}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !progress && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Write a personal message for each lead</DialogTitle>
            <DialogDescription>
              {kind === "email"
                ? <>The AI researches each lead and writes an opener, subject and email, saved as {"{{ai_opener}}"}, {"{{ai_subject}}"} and {"{{ai_body}}"}.</>
                : <>The AI researches each lead and writes a short LinkedIn message, saved as {"{{ai_linkedin}}"}.</>}
            </DialogDescription>
          </DialogHeader>
          <Tabs value={kind} onValueChange={(v) => setKind(v as "email" | "linkedin")}>
            <TabsList><TabsTrigger value="email">Cold email</TabsTrigger><TabsTrigger value="linkedin">LinkedIn message</TabsTrigger></TabsList>
          </Tabs>
          {q && (q.ownKey
            ? <p className="text-sm text-muted-foreground">Using your own AI key: unlimited.</p>
            : !q.enabled
              ? <p className="text-sm text-destructive">Free AI is turned off for your account. Add your own key in Settings or use AceMail MCP in ChatGPT or Claude.</p>
              : <p className="text-sm text-muted-foreground">
                  Free AI: <strong className="text-foreground">{Math.max(0, left ?? 0)}</strong> {kind === "email" ? "emails" : "LinkedIn messages"} left today.
                  {(left ?? 0) < ids.length && " For unlimited, connect AceMail MCP in ChatGPT or Claude, or add your own AI key in Settings."}
                </p>)}
          <Textarea rows={5} value={instructions} onChange={(e) => setInstructions(e.target.value)}
            placeholder="What do you offer and what tone? e.g. We build Shopify stores for D2C brands. Friendly, short, ask for a 15 min call." />
          {progress && <p className="text-sm text-muted-foreground">Working… {progress.done + progress.failed} of {ids.length} done{progress.failed ? `, ${progress.failed} failed` : ""}</p>}
          <DialogFooter>
            <Button onClick={() => void run()} disabled={!!progress}>
              {progress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />} Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
