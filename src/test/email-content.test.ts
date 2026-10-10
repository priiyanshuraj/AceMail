import { describe, it, expect } from "vitest";
import { emailHtml, mediaPaths, inboxDocument, renderEmailVariables } from "@/lib/email-content";
import { trackCampaignLinks } from "@/server/campaign-tracking.server";
import { prepareEmail } from "@/server/email-content.server";

describe("Email formatting", () => {
  it("preserves sheet paragraph spacing inside rich HTML and delivery preparation", async () => {
    const draft = "Hi Rajas,\r\n\r\nQuick question?\n\nBetween releases?\r\rWorth a look?";
    const html = renderEmailVariables('<p>{{personalized_email_draft}}</p>', { personalized_email_draft: draft }, true);
    expect(html).toBe('<p>Hi Rajas,<br /><br />Quick question?<br /><br />Between releases?<br /><br />Worth a look?</p>');
    expect(inboxDocument(html)).toContain(html);
    const prepared = await prepareEmail(html, "owner", {} as Parameters<typeof prepareEmail>[2]);
    expect(prepared.html).toBe(html);
  });
  it("escapes imported text without changing subject text or re-expanding variables", () => {
    const values = { draft: 'A & B <script>alert(1)</script>\n{{company}}', company: "Acme" };
    expect(renderEmailVariables('<p>{{ draft }}</p>', values, true)).toBe('<p>A &amp; B &lt;script&gt;alert(1)&lt;/script&gt;<br />{{company}}</p>');
    expect(renderEmailVariables('{{draft}}', values)).toBe(values.draft);
    expect(renderEmailVariables('Hello\n\n{{draft}}', { draft: 'One\n\nTwo' }, true)).toBe('Hello<br /><br />One<br /><br />Two');
  });
  it("preserves email table layouts and inline HTML styling", () => {
    const html = emailHtml('<table cellpadding="12" style="width:100%;background-color:#123456"><tr><td style="font-size:20px;padding:12px;text-align:center">Hello</td></tr></table>');
    expect(html).toContain('<table cellpadding="12"');
    expect(html).toContain('background-color:#123456');
    expect(html).toContain('padding:12px');
    expect(inboxDocument(html)).toContain("Content-Security-Policy");
  });
  it("keeps video links and removes unsupported executable embeds", () => {
    expect(emailHtml('<a href="https://loom.com/share/example">▶ Watch video</a><iframe src="https://loom.com"></iframe>')).toBe('<a href="https://loom.com/share/example">▶ Watch video</a>');
  });
  it("tracks only web links with stored opaque IDs", async () => {
    const db = { from: () => ({ upsert: () => ({ select: async () => ({ data: [{ id: "opaque", destination: "https://example.com/?a=1&b=2" }], error: null }) }) }) };
    const result = await trackCampaignLinks('<a href="https://example.com/?a=1&amp;b=2">Website</a><a href="mailto:hi@example.com">Email</a><img src="cid:image@acemail" />', "log", "owner", "https://acemail.lovable.app", db as unknown as Parameters<typeof trackCampaignLinks>[4]);
    expect(result).toContain('href="https://acemail.lovable.app/api/public/click/opaque"');
    expect(result).toContain('href="mailto:hi@example.com"');
    expect(result).toContain('src="cid:image@acemail"');
  });
  it("keeps legacy text and rich formatting", () => {
    expect(emailHtml("Hello\nWorld")).toBe("Hello<br />World");
    expect(emailHtml('<p><strong>Bold</strong> <u>Underline</u></p>')).toContain("<strong>Bold</strong>");
  });
  it("removes executable content and unsafe links", () => {
    const html = emailHtml('<p onclick="alert(1)">Hello<script>alert(1)</script><a href="javascript:alert(1)">Link</a></p>');
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
  });
  it("preserves private file references and extracts unique paths", () => {
    const html = emailHtml('<p><a href="acemail-file:user/file.pdf">File</a><img src="acemail-file:user/image.png" /></p>');
    expect(mediaPaths(html)).toEqual(["user/file.pdf", "user/image.png"]);
  });
  it("rejects references to another user's uploads", async () => {
    await expect(prepareEmail('<p><a href="acemail-file:other/file">File</a></p>', "owner", {} as Parameters<typeof prepareEmail>[2])).rejects.toThrow("Invalid email attachment");
  });
  it("prepares inline images and downloadable attachments for sending", async () => {
    const db = { storage: { from: () => ({ download: async () => ({ data: { size: 7, type: "image/png", arrayBuffer: async () => new TextEncoder().encode("example").buffer }, error: null }) }) } };
    const result = await prepareEmail('<p><img src="acemail-file:owner/image.png" /><a href="acemail-file:owner/file.pdf">File</a></p>', "owner", db as unknown as Parameters<typeof prepareEmail>[2]);
    expect(result.html).toContain('src="cid:image-0@acemail"');
    expect(result.html).not.toContain("acemail-file:");
    expect(result.attachments).toHaveLength(2);
    expect(result.attachments[0]?.cid).toBe("image-0@acemail");
    expect(result.attachments[1]?.cid).toBeUndefined();
  });
});