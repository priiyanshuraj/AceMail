// Free email verification: syntax, disposable/role checks and live MX lookup over DNS-over-HTTPS.
export type EmailCheck = { email: string; status: "valid" | "risky" | "invalid"; reason: string };

const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "temp-mail.org", "yopmail.com",
  "trashmail.com", "getnada.com", "dispostable.com", "sharklasers.com", "maildrop.cc", "throwawaymail.com",
  "fakeinbox.com", "mailnesia.com", "mintemail.com", "emailondeck.com", "moakt.com", "tempail.com",
  "mohmal.com", "burnermail.io", "spamgourmet.com", "trashmail.de", "mytemp.email", "tempr.email",
]);
const ROLE = new Set([
  "info", "admin", "support", "sales", "contact", "hello", "noreply", "no-reply", "help", "office",
  "billing", "marketing", "team", "jobs", "careers", "hr", "webmaster", "postmaster", "abuse", "privacy", "legal",
]);
const SYNTAX = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

async function dns(name: string, type: "MX" | "A"): Promise<number | null> {
  try {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
      headers: { accept: "application/dns-json" },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { Status: number; Answer?: { type: number; data: string }[] };
    if (j.Status === 3) return 0; // NXDOMAIN
    const want = type === "MX" ? 15 : 1;
    const ans = (j.Answer ?? []).filter((a) => a.type === want && !(type === "MX" && /^0\s+\.$/.test(a.data.trim())));
    return ans.length;
  } catch {
    return null; // network error — unknown
  }
}

async function checkDomain(domain: string): Promise<{ ok: boolean | null; reason: string }> {
  const mx = await dns(domain, "MX");
  if (mx === null) return { ok: null, reason: "Domain lookup failed" };
  if (mx > 0) return { ok: true, reason: "" };
  const a = await dns(domain, "A");
  if (a && a > 0) return { ok: true, reason: "No MX record (uses fallback)" };
  return { ok: false, reason: mx === 0 ? "Domain has no mail servers" : "Domain lookup failed" };
}

export async function verifyEmailList(emails: string[]): Promise<EmailCheck[]> {
  const norm = emails.map((e) => e.trim().toLowerCase());
  const domains = [...new Set(norm.filter((e) => SYNTAX.test(e)).map((e) => e.split("@")[1] ?? ""))];
  const results = new Map<string, { ok: boolean | null; reason: string }>();
  for (let i = 0; i < domains.length; i += 20) {
    const batch = domains.slice(i, i + 20);
    const rs = await Promise.all(batch.map(checkDomain));
    batch.forEach((d, k) => results.set(d, rs[k]!));
  }
  return norm.map((email) => {
    if (!SYNTAX.test(email) || email.includes("..")) return { email, status: "invalid", reason: "Invalid email format" };
    const [local = "", domain = ""] = email.split("@");
    const d = results.get(domain)!;
    if (d.ok === false) return { email, status: "invalid", reason: d.reason };
    if (DISPOSABLE.has(domain)) return { email, status: "risky", reason: "Disposable email provider" };
    if (d.ok === null) return { email, status: "risky", reason: d.reason };
    if (ROLE.has(local.split("+")[0] ?? "")) return { email, status: "risky", reason: "Role-based address" };
    if (d.reason) return { email, status: "risky", reason: d.reason };
    return { email, status: "valid", reason: "" };
  });
}
