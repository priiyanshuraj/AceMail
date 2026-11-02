import { useState } from "react";
import { Wand2, Loader2 } from "lucide-react";
import { personalizeContacts } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export function AiPersonalizeButton({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [progress, setProgress] = useState<{ done: number; failed: number } | null>(null);

  const run = async () => {
    let done = 0, failed = 0;
    setProgress({ done, failed });
    try {
      for (let i = 0; i < ids.length; i += 5) {
        const { results } = await personalizeContacts({ data: { ids: ids.slice(i, i + 5), instructions } });
        done += results.filter((r) => r.ok).length;
        const bad = results.filter((r) => !r.ok);
        failed += bad.length;
        setProgress({ done, failed });
        if (bad.length === results.length && bad[0]?.error) throw new Error(bad[0].error);
      }
      toast.success(`Wrote personalised messages for ${done} lead${done === 1 ? "" : "s"}`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI writing failed");
    } finally {
      setProgress(null);
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
              The AI researches each lead's company and writes an opener, subject and email. They are saved as {"{{ai_opener}}"}, {"{{ai_subject}}"} and {"{{ai_body}}"} to use in your templates.
            </DialogDescription>
          </DialogHeader>
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
