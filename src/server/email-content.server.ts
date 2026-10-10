import { emailHtml, mediaPaths } from "@/lib/email-content";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type EmailAttachment = { filename: string; contentType: string; base64: string; cid?: string | undefined };

export async function prepareEmail(body: string, userId: string, db: SupabaseClient<Database>) {
  let html = emailHtml(body);
  const attachments: EmailAttachment[] = [];
  const paths = mediaPaths(html);
  if (paths.length > 10) throw new Error("Use at most 10 uploaded files per email");
  let total = 0;
  for (const path of paths) {
    if (!path.startsWith(`${userId}/`) || path.includes("..")) throw new Error("Invalid email attachment");
    const { data, error } = await db.storage.from("template-files").download(path);
    if (error || !data) throw new Error("An uploaded email file is no longer available");
    total += data.size;
    if (total > 15 * 1024 * 1024) throw new Error("Email attachments must total less than 15 MB");
    const inline = html.includes(`src="acemail-file:${path}"`);
    const cid = inline ? `image-${attachments.length}@acemail` : undefined;
    const bytes = new Uint8Array(await data.arrayBuffer());
    let binary = "";
    for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
    attachments.push({ filename: path.split("/").pop()?.replace(/^[a-f0-9-]{36}-/, "") ?? "attachment", contentType: data.type || "application/octet-stream", base64: btoa(binary), cid });
    html = html.replaceAll(`acemail-file:${path}`, cid ? `cid:${cid}` : "#");
  }
  return { html, attachments };
}