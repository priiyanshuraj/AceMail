import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TextStyle, FontFamily, FontSize } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, Link, ImagePlus, Paperclip, Code, FileText, Video, Calendar, Undo, Redo, AlignLeft, AlignCenter, AlignRight, RemoveFormatting } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { emailHtml, escapeEmailText, mediaPaths, inboxDocument } from "@/lib/email-content";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";

export type BodyEditorHandle = { insert: (value: string) => void };
type Props = { value: string; onChange: (value: string) => void; onFocus: () => void; templates: { id: string; name: string; body: string }[] };
const PrivateImage = Image.extend({
  addNodeView() {
    return ({ node }) => {
      const img = document.createElement("img");
      img.alt = String(node.attrs["alt"] ?? "Uploaded image");
      const src = String(node.attrs["src"] ?? "");
      if (src.startsWith("acemail-file:")) {
        void supabase.storage.from("template-files").createSignedUrl(src.slice(13), 3600).then(({ data }) => { if (data) img.src = data.signedUrl; });
      } else img.src = src;
      return { dom: img };
    };
  },
});
export const TemplateBodyEditor = forwardRef<BodyEditorHandle, Props>(function TemplateBodyEditor({ value, onChange, onFocus, templates }, ref) {
  const [raw, setRaw] = useState(() => /<(table|html|head|style)\b/i.test(value));
  const [dialog, setDialog] = useState<"link" | "video" | "meeting" | "template" | null>(null);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const rawRef = useRef<HTMLTextAreaElement>(null);
  const uploadKind = useRef<"image" | "file">("image");
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [StarterKit.configure({ link: { openOnClick: false, protocols: ["acemail-file"] } }), PrivateImage.configure({ allowBase64: false }), TextStyle, FontFamily, FontSize, TextAlign.configure({ types: ["heading", "paragraph"] })],
    content: emailHtml(value),
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onFocus,
    editorProps: { attributes: { class: "email-editor min-h-64 p-4 outline-none text-sm", "aria-label": "Template body", role: "textbox", "aria-multiline": "true" } },
  });
  useEffect(() => {
    if (editor && !raw && editor.getHTML() !== emailHtml(value)) editor.commands.setContent(emailHtml(value), { emitUpdate: false });
  }, [value, editor, raw]);
  const insert = (html: string) => {
    if (raw) {
      const start = rawRef.current?.selectionStart ?? value.length;
      const end = rawRef.current?.selectionEnd ?? start;
      onChange(value.slice(0, start) + html + value.slice(end));
    } else editor?.chain().focus().insertContent(html).run();
  };
  useImperativeHandle(ref, () => ({ insert: (text) => insert(escapeEmailText(text)) }));
  const tools: { name: string; icon: LucideIcon; active?: boolean | undefined; run: () => unknown }[] = [
    { name: "Bold", icon: Bold, active: editor?.isActive("bold"), run: () => editor?.chain().focus().toggleBold().run() },
    { name: "Italic", icon: Italic, active: editor?.isActive("italic"), run: () => editor?.chain().focus().toggleItalic().run() },
    { name: "Underline", icon: Underline, active: editor?.isActive("underline"), run: () => editor?.chain().focus().toggleUnderline().run() },
    { name: "Strikethrough", icon: Strikethrough, active: editor?.isActive("strike"), run: () => editor?.chain().focus().toggleStrike().run() },
    { name: "Bullet list", icon: List, active: editor?.isActive("bulletList"), run: () => editor?.chain().focus().toggleBulletList().run() },
    { name: "Numbered list", icon: ListOrdered, active: editor?.isActive("orderedList"), run: () => editor?.chain().focus().toggleOrderedList().run() },
    ...(["left", "center", "right"] as const).map((align) => ({ name: `Align ${align}`, icon: align === "left" ? AlignLeft : align === "center" ? AlignCenter : AlignRight, active: editor?.isActive({ textAlign: align }), run: () => editor?.chain().focus().setTextAlign(align).run() })),
    { name: "Clear formatting", icon: RemoveFormatting, run: () => editor?.chain().focus().unsetAllMarks().clearNodes().run() },
    { name: "Undo", icon: Undo, run: () => editor?.chain().focus().undo().run() },
    { name: "Redo", icon: Redo, run: () => editor?.chain().focus().redo().run() },
  ];
  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) { toast.error("Each file must be under 10 MB"); return; }
    if (mediaPaths(value).length >= 10) { toast.error("Use at most 10 uploads per email"); return; }
    if (uploadKind.current === "image" && !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) { toast.error("Choose a JPG, PNG, GIF, or WebP image"); return; }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in before uploading");
      const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("template-files").upload(path, file);
      if (error) throw error;
      const src = `acemail-file:${path}`;
      insert(uploadKind.current === "image" ? `<img src="${src}" alt="${escapeEmailText(file.name)}" />` : `<p><a href="${src}">${escapeEmailText(file.name)}</a></p>`);
      toast.success("File added");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Upload failed"); }
    finally { setUploading(false); }
  }
  return <div className="rounded-md border bg-background overflow-hidden">
    <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-2">
      <Select disabled={raw} onValueChange={(font) => editor?.chain().focus().setFontFamily(font).run()}><SelectTrigger className="w-32 h-8" aria-label="Font family"><SelectValue placeholder="Sans serif" /></SelectTrigger><SelectContent><SelectItem value="Arial">Sans serif</SelectItem><SelectItem value="Georgia">Serif</SelectItem><SelectItem value="monospace">Monospace</SelectItem></SelectContent></Select>
      <Select disabled={raw} onValueChange={(size) => editor?.chain().focus().setFontSize(size).run()}><SelectTrigger className="w-24 h-8" aria-label="Font size"><SelectValue placeholder="Normal" /></SelectTrigger><SelectContent><SelectItem value="12px">Small</SelectItem><SelectItem value="16px">Normal</SelectItem><SelectItem value="20px">Large</SelectItem><SelectItem value="24px">Larger</SelectItem></SelectContent></Select>
      {tools.map((tool) => <Button key={tool.name} type="button" size="icon" variant={tool.active ? "secondary" : "ghost"} className="h-8 w-8" title={tool.name} aria-label={tool.name} aria-pressed={tool.active ?? false} disabled={raw} onMouseDown={(e) => e.preventDefault()} onClick={tool.run}><tool.icon className="h-4 w-4" /></Button>)}
    </div>
    {raw ? <Textarea ref={rawRef} aria-label="Raw HTML body" value={value} onFocus={onFocus} onChange={(e) => onChange(e.target.value)} className="min-h-64 rounded-none border-0 font-mono" /> : <EditorContent editor={editor} />}
    <div className="flex flex-wrap gap-1 border-t bg-muted/30 p-2">
      {([{ kind: "link", icon: Link, name: "Insert link" }, { kind: "video", icon: Video, name: "Add video link" }, { kind: "meeting", icon: Calendar, name: "Insert meeting link" }, { kind: "template", icon: FileText, name: "Load template" }] as const).map((tool) => <Button key={tool.kind} type="button" size="icon" variant="ghost" title={tool.name} aria-label={tool.name} onClick={() => { setUrl(""); setLabel(tool.kind === "video" ? "▶ Watch video" : tool.kind === "meeting" ? "Book a meeting" : ""); setDialog(tool.kind); }}><tool.icon className="h-4 w-4" /></Button>)}
      <Button type="button" size="icon" variant="ghost" title="Upload image" aria-label="Upload image" disabled={uploading} onClick={() => { uploadKind.current = "image"; if (uploadRef.current) { uploadRef.current.accept = "image/png,image/jpeg,image/gif,image/webp"; uploadRef.current.click(); } }}><ImagePlus className="h-4 w-4" /></Button>
      <Button type="button" size="icon" variant="ghost" title="Attach files" aria-label="Attach files" disabled={uploading} onClick={() => { uploadKind.current = "file"; if (uploadRef.current) { uploadRef.current.accept = "*/*"; uploadRef.current.click(); } }}><Paperclip className="h-4 w-4" /></Button>
      <Button type="button" size="icon" variant={raw ? "secondary" : "ghost"} title={raw ? "Visual editor" : "Edit HTML"} aria-label={raw ? "Visual editor" : "Edit HTML"} onClick={() => { if (raw && /<(table|html|head|style)\b/i.test(value)) { toast.info("Keep this layout in HTML mode to preserve its design."); return; } if (raw) onChange(emailHtml(value)); setRaw(!raw); }}><Code className="h-4 w-4" /></Button>
      {uploading && <span className="self-center text-xs text-muted-foreground">Uploading…</span>}
    </div>
    <input ref={uploadRef} type="file" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} />
    <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) setDialog(null); }}><DialogContent><DialogHeader><DialogTitle>{dialog === "template" ? "Load template body" : dialog === "video" ? "Add video" : dialog === "meeting" ? "Meeting link" : "Insert link"}</DialogTitle></DialogHeader>
      {dialog === "template" ? <div className="max-h-80 overflow-y-auto space-y-2">{templates.length === 0 && <p className="text-sm text-muted-foreground">No saved templates yet.</p>}{templates.map((template) => <Button key={template.id} variant="outline" className="w-full justify-start" onClick={() => { onChange(emailHtml(template.body)); setDialog(null); }}>{template.name}</Button>)}</div> : <div className="space-y-3"><Input aria-label="Link URL" placeholder={dialog === "video" ? "YouTube, Loom, Vimeo, or any video URL" : "https://…"} value={url} onChange={(e) => setUrl(e.target.value)} /><Input aria-label="Link text" placeholder="Text to display" value={label} onChange={(e) => setLabel(e.target.value)} /><Button onClick={() => { try { const parsed = new URL(url); if (!["https:", "http:"].includes(parsed.protocol)) throw new Error(); insert(`<a href="${escapeEmailText(parsed.href)}">${escapeEmailText(label || parsed.href)}</a>`); setDialog(null); } catch { toast.error("Enter a valid http or https link"); } }}>Insert</Button></div>}
    </DialogContent></Dialog>
  </div>;
});

export function EmailPreview({ body }: { body: string }) {
  const [resolved, setResolved] = useState<{ source: string; html: string; files: { name: string; url: string }[]; failed: boolean } | null>(null);
  const [height, setHeight] = useState(320);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    let current = true;
    async function resolve() {
      let next = emailHtml(body);
      let failed = false;
      const files: { name: string; url: string }[] = [];
      for (const path of mediaPaths(next)) {
        const inline = next.includes(`src="acemail-file:${path}"`);
        try {
          const { data, error } = await supabase.storage.from("template-files").createSignedUrl(path, 3600);
          if (data && !error) {
            if (!inline) files.push({ name: path.split("/").pop()?.replace(/^[a-f0-9-]{36}-/, "") ?? "Attachment", url: data.signedUrl });
            next = next.replaceAll(`acemail-file:${path}`, inline ? data.signedUrl.replaceAll("&", "&amp;") : "#");
          } else failed = true;
        } catch { failed = true; }
      }
      if (current) setResolved({ source: body, html: next, files, failed });
    }
    void resolve();
    return () => { current = false; };
  }, [body]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const document = frame.current?.contentDocument;
      if (document?.body) setHeight(Math.min(900, Math.max(240, document.body.scrollHeight + 32)));
    }, 300);
    return () => window.clearInterval(timer);
  }, []);
  const ready = resolved?.source === body;
  return <div className="space-y-3">
    <iframe ref={frame} title="Inbox email preview" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcDoc={inboxDocument(ready ? resolved.html : body)} className="w-full border-0 rounded-md" style={{ height }} />
    {!ready && mediaPaths(body).length > 0 && <p className="text-xs text-muted-foreground">Loading attachments…</p>}
    {ready && resolved.failed && <p className="text-sm text-destructive">Some uploaded files could not be loaded. Re-upload them before sending.</p>}
    {ready && resolved.files.length > 0 && <div className="flex flex-wrap gap-2 border-t pt-3">{resolved.files.map((file) => <Button key={file.url} variant="outline" size="sm" asChild><a href={file.url} target="_blank" rel="noopener noreferrer"><Paperclip className="mr-2 h-4 w-4" />{file.name}</a></Button>)}</div>}
  </div>;
}
