import sanitizeHtml from "sanitize-html";

export const escapeEmailText = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function emailHtml(body: string): string {
  const html = /<\/?(?:p|div|html|strong|em|span|a|img|ul|ol|br|h[1-6])\b/i.test(body)
    ? body : escapeEmailText(body).replace(/\n/g, "<br />");
  return sanitizeHtml(html, {
    allowedTags: ["p", "div", "br", "strong", "b", "em", "i", "u", "s", "span", "a", "img", "ul", "ol", "li", "h1", "h2", "h3", "blockquote", "hr"],
    allowedAttributes: { "*": ["style"], a: ["href", "target", "rel", "data-acemail-file"], img: ["src", "alt", "width", "height"] },
    allowedSchemes: ["https", "http", "mailto", "cid", "acemail-file"],
    allowedStyles: { "*": { "color": [/^#[a-f\d]{3,8}$/i], "font-family": [/^[\w ,'-]+$/], "font-size": [/^\d+(px|pt|em)$/], "text-align": [/^(left|right|center|justify)$/], "text-decoration": [/^(underline|line-through)$/] } },
  });
}

export function mediaPaths(html: string) {
  return [...new Set([...html.matchAll(/acemail-file:([^"<>\s]+)/g)].flatMap((match) => match[1] ? [match[1]] : []))];
}