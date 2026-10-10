import sanitizeHtml from "sanitize-html";

export const escapeEmailText = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const variablePattern = () => /\{\{\s*([^{}<>\r\n]+?)\s*\}\}/gu;
const unprefixVariable = (key: string) => key.trim().replace(/^contact\s*\.\s*/i, "");
const normalizeVariable = (key: string) => key.trim().normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

export function detectEmailVariables(...templates: string[]): string[] {
  return [...new Set(templates.flatMap((template) =>
    [...template.matchAll(variablePattern())].map((match) => (match[1] ?? "").trim()).filter(Boolean)
  ))];
}

/** Exact keys win; normalized aliases must match one field, never an arbitrary field. */
export function resolveEmailVariableKey(key: string, values: Record<string, unknown>): string | undefined {
  const trimmed = key.trim();
  if (Object.hasOwn(values, trimmed)) return trimmed;
  const bare = unprefixVariable(trimmed);
  if (Object.hasOwn(values, bare)) return bare;
  const normalized = normalizeVariable(bare);
  if (!normalized) return undefined;
  const aliases = new Set([normalized, normalizeVariable(trimmed)]);
  const matches = Object.keys(values).filter((field) => aliases.has(normalizeVariable(field)));
  return matches.length === 1 ? matches[0] : undefined;
}

/** Contact values are plain text, not HTML; retain each imported line break. */
export function renderEmailVariables(template: string, values: Record<string, unknown>, html = false, missing: (key: string) => string = () => "") {
  const source = html ? emailHtml(template) : template;
  const rendered = source.replace(variablePattern(), (_match, rawKey: string) => {
    const key = rawKey.trim();
    if (!key) return _match;
    const field = resolveEmailVariableKey(key, values);
    const value = field === undefined ? undefined : values[field];
    const text = value === undefined || value === null || value === "" ? missing(key) : String(value);
    return html ? escapeEmailText(text).replace(/\r\n|\r|\n/g, "<br />") : text;
  });
  return html ? emailHtml(rendered) : rendered;
}

export function emailHtml(body: string): string {
  const html = /<\/?[a-z][a-z0-9]*\b[^>]*>/i.test(body)
    ? body : escapeEmailText(body).replace(/\n/g, "<br />");
  return sanitizeHtml(html, {
    allowedTags: ["p", "div", "br", "strong", "b", "em", "i", "u", "s", "span", "a", "img", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "hr", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "center", "pre", "code", "font"],
    allowedAttributes: { "*": ["style", "align", "width", "height"], table: ["cellpadding", "cellspacing", "border", "role", "bgcolor"], td: ["colspan", "rowspan", "valign", "bgcolor"], th: ["colspan", "rowspan", "valign", "bgcolor"], font: ["color", "face", "size"], a: ["href", "target", "rel", "data-acemail-file"], img: ["src", "alt", "width", "height"] },
    allowedSchemes: ["https", "http", "mailto", "cid", "acemail-file"],
    allowedStyles: { "*": {
      "color": [/^#[a-f\d]{3,8}$/i, /^[a-z]+$/i, /^rgba?\([\d\s.,%]+\)$/i],
      "background-color": [/^#[a-f\d]{3,8}$/i, /^[a-z]+$/i, /^rgba?\([\d\s.,%]+\)$/i],
      "font-family": [/^[\w ,'-]+$/], "font-size": [/^[\d.]+(px|pt|em|rem|%)$/],
      "font-weight": [/^(normal|bold|[1-9]00)$/], "font-style": [/^(normal|italic)$/],
      "text-align": [/^(left|right|center|justify)$/], "text-decoration": [/^(none|underline|line-through)$/],
      "width": [/^[\d.]+(px|pt|em|rem|%)$/, /^auto$/], "height": [/^[\d.]+(px|pt|em|rem|%)$/, /^auto$/],
      "max-width": [/^[\d.]+(px|pt|em|rem|%)$/], "line-height": [/^[\d.]+(px|pt|em|rem|%)?$/],
      "padding": [/^[\d.\s]+(px|pt|em|rem|%)(\s+[\d.]+(px|pt|em|rem|%)){0,3}$/],
      "margin": [/^(auto|0|[\d.]+(px|pt|em|rem|%))(\s+(auto|0|[\d.]+(px|pt|em|rem|%))){0,3}$/],
      "border": [/^[\d.]+px\s+(solid|dashed|dotted)\s+#[a-f\d]{3,8}$/i], "border-radius": [/^[\d.]+(px|%)$/],
      "border-collapse": [/^(collapse|separate)$/], "vertical-align": [/^(top|middle|bottom)$/],
      "display": [/^(block|inline|inline-block|none|table|table-cell|table-row)$/],
    } },
  });
}

export function inboxDocument(body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline';"><style>body{margin:0;padding:16px;background:#fff;color:#202124;font:14px/1.5 Arial,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}a{color:#1155cc}p{margin:0 0 12px}table{max-width:100%}pre{white-space:pre-wrap}</style></head><body>${emailHtml(body)}</body></html>`;
}

export function mediaPaths(html: string) {
  return [...new Set([...html.matchAll(/acemail-file:([^"<>\s]+)/g)].flatMap((match) => match[1] ? [match[1]] : []))];
}