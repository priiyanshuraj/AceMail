import sanitizeHtml from "sanitize-html";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function trackCampaignLinks(html: string, logId: string, userId: string, appUrl: string, db: SupabaseClient<Database>) {
  const origin = new URL(appUrl).origin;
  if (!origin.startsWith("https://") && !origin.startsWith("http://localhost")) throw new Error("Invalid tracking address");
  const destinations = new Set<string>();
  sanitizeHtml(html, { allowedTags: false, allowedAttributes: false, transformTags: { a: (tagName, attribs) => {
    const href = attribs["href"];
    if (href && /^https?:\/\//i.test(href)) destinations.add(href);
    return { tagName, attribs };
  } } });
  if (destinations.size === 0) return html;
  const { data: links, error } = await db.from("email_tracking_links").upsert(
    [...destinations].map((destination) => ({ log_id: logId, user_id: userId, destination })),
    { onConflict: "log_id,destination" },
  ).select("id, destination");
  if (error || !links) throw new Error("Could not prepare campaign tracking");
  const urls = new Map(links.map((link) => [link.destination, `${origin}/api/public/click/${link.id}`]));
  return sanitizeHtml(html, { allowedTags: false, allowedAttributes: false, transformTags: { a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, href: urls.get(attribs["href"] ?? "") ?? attribs["href"] ?? "#" } }) } });
}