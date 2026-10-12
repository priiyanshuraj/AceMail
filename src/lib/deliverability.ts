// Free, AI-free deliverability helpers shared by preview, test sends and the queue.

// Spintax: {Hi|Hello|Hey} picks one option. {{variables}} are left untouched.
const spinPattern = /\{([^{}]*\|[^{}]*)\}/;

export function spin(text: string, random: () => number = Math.random): string {
  let out = text;
  for (let i = 0; i < 500; i++) {
    const m = out.match(spinPattern);
    if (!m || m.index === undefined) break;
    const options = (m[1] ?? "").split("|");
    const pick = options[Math.floor(random() * options.length)] ?? "";
    out = out.slice(0, m.index) + pick + out.slice(m.index + m[0].length);
  }
  return out;
}

export function hasSpintax(text: string) {
  return spinPattern.test(text);
}

/** Deterministic random for stable previews. */
export function seededRandom(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const SPAM_WORDS = [
  "100% free", "act now", "apply now", "as seen on", "buy now", "call now", "cash bonus", "cheap", "click here",
  "click below", "congratulations", "dear friend", "double your", "earn money", "extra cash", "fast cash", "free gift",
  "free trial", "free access", "guarantee", "guaranteed", "increase sales", "limited time", "lowest price", "make money",
  "million dollars", "miracle", "no cost", "no credit check", "no obligation", "not spam", "offer expires", "once in a lifetime",
  "order now", "risk free", "risk-free", "special promotion", "this isn't spam", "urgent", "winner", "you have been selected",
  "100% satisfied", "best price", "big bucks", "cancel at any time", "instant", "investment", "lose weight", "viagra", "casino",
  "crypto", "bitcoin", "work from home", "be your own boss", "exclusive deal", "last chance", "while supplies last",
];

export type SpamIssue = { label: string; detail: string };

export function spamCheck(subject: string, html: string): { score: number; issues: SpamIssue[] } {
  const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ");
  const all = `${subject} ${text}`.toLowerCase();
  const issues: SpamIssue[] = [];
  const words = SPAM_WORDS.filter((w) => all.includes(w));
  if (words.length) issues.push({ label: "Spam trigger words", detail: words.map((w) => `“${w}”`).join(", ") });
  const letters = subject.replace(/[^a-z]/gi, "");
  if (letters.length >= 6 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.6)
    issues.push({ label: "Subject is mostly CAPITALS", detail: "Write the subject in normal case." });
  if (/[!?]{2,}/.test(subject) || (subject.match(/!/g)?.length ?? 0) > 1)
    issues.push({ label: "Too many ! or ?", detail: "Use at most one exclamation mark." });
  if (/[$€£₹]\s?\d/.test(all)) issues.push({ label: "Money amounts", detail: "Prices in a first email can look promotional." });
  const links = (html.match(/<a\s/gi) ?? []).length;
  if (links > 3) issues.push({ label: `${links} links`, detail: "Cold emails do best with 0–2 links." });
  const images = (html.match(/<img\s/gi) ?? []).length;
  if (images > 2) issues.push({ label: `${images} images`, detail: "Image-heavy emails often land in promotions/spam." });
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount > 250) issues.push({ label: `${wordCount} words`, detail: "Shorter emails (50–150 words) get more replies." });
  if (subject.length > 70) issues.push({ label: "Long subject", detail: "Keep subjects under ~60 characters." });
  const score = Math.max(0, 100 - words.length * 12 - (issues.length - (words.length ? 1 : 0)) * 8);
  return { score, issues };
}

export function unsubscribeFooter(url: string) {
  return `<div style="margin-top:24px;font-size:12px;color:#888888">Don't want to hear from me? <a href="${url}" style="color:#888888">Unsubscribe</a></div>`;
}

/** Contact time zone from a custom field named timezone / time zone / tz. */
export function contactTimezone(custom: Record<string, unknown> | null | undefined): string | null {
  if (!custom) return null;
  for (const [k, v] of Object.entries(custom)) {
    if (/^(time\s*_?zone|tz)$/i.test(k.trim()) && typeof v === "string" && v.trim()) {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: v.trim() });
        return v.trim();
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function isAutoReply(subject: string, headers: { name: string; value: string }[]) {
  const h = (n: string) => headers.find((x) => x.name.toLowerCase() === n)?.value ?? "";
  const auto = h("auto-submitted");
  if (auto && auto.toLowerCase() !== "no") return true;
  if (h("x-autoreply") || h("x-autorespond") || /auto_reply|bulk/i.test(h("precedence"))) return true;
  return /\b(out of (the )?office|automatic reply|auto[- ]?reply|autoreply|away from (the )?office|on (annual )?leave|on vacation|abwesenheit)\b/i.test(subject);
}
