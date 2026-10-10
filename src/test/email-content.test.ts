import { describe, it, expect } from "vitest";
import { emailHtml, mediaPaths } from "@/lib/email-content";
import { prepareEmail } from "@/server/email-content.server";

describe("Email formatting", () => {
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
});