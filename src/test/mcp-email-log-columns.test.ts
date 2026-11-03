import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Columns that actually exist on public.email_logs (verified against the live schema).
const EMAIL_LOG_COLUMNS = new Set([
  "id", "user_id", "campaign_id", "step_id", "contact_id", "status", "error",
  "scheduled_at", "sent_at", "opened_at", "created_at", "gmail_message_id",
  "gmail_thread_id", "replied_at", "direct_to", "direct_subject", "config_id",
  "bounced_at", "recipient_email", "variant",
]);

// Embedded-resource names PostgREST resolves through foreign keys.
const EMAIL_LOG_EMBEDS = new Set(["contacts"]);

function emailLogsSelectColumns(file: string): string[] {
  const source = readFileSync(path.resolve(process.cwd(), file), "utf8");
  const columns: string[] = [];
  const pattern = /from\("email_logs"\)\s*\.select\(\s*"([^"]+)"/g;
  for (const match of source.matchAll(pattern)) {
    for (const column of match[1].split(",")) {
      const name = column.trim().split("(")[0].trim();
      if (name) columns.push(name);
    }
  }
  return columns;
}

describe("MCP queries against email_logs", () => {
  it("only selects columns that exist on email_logs (no phantom subject column)", () => {
    const columns = emailLogsSelectColumns("src/lib/mcp/tools/linkedin.ts");
    expect(columns.length).toBeGreaterThan(0);
    expect(columns.filter((c) => !EMAIL_LOG_COLUMNS.has(c) && !EMAIL_LOG_EMBEDS.has(c))).toEqual([]);
  });

  it("surfaces query errors instead of returning an empty email history", () => {
    const source = readFileSync(path.resolve(process.cwd(), "src/lib/mcp/tools/linkedin.ts"), "utf8");
    const detail = source.slice(source.indexOf("export const getContactDetail"));
    expect(detail).toContain("emailErr");
    expect(detail).toMatch(/if \(emailErr\) throw new ToolError/);
  });
});
