// Server-only Apollo.io enrichment using each user's own API key.
import { encryptConnectionKey, decryptConnectionKey } from "@/server/connectionKeyCrypto";

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export async function saveApolloKey(userId: string, key: string) {
  const db = await admin();
  const { error } = await db.from("user_api_keys").upsert({
    user_id: userId, provider: "apollo", key_ciphertext: encryptConnectionKey(key), hint: key.slice(-4), updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function apolloKeyHint(userId: string) {
  const db = await admin();
  const { data } = await db.from("user_api_keys").select("hint").eq("user_id", userId).eq("provider", "apollo").maybeSingle();
  return data?.hint ?? null;
}

export async function deleteApolloKey(userId: string) {
  const db = await admin();
  await db.from("user_api_keys").delete().eq("user_id", userId).eq("provider", "apollo");
}

async function getKey(userId: string) {
  const db = await admin();
  const { data } = await db.from("user_api_keys").select("key_ciphertext").eq("user_id", userId).eq("provider", "apollo").maybeSingle();
  if (!data) throw new Error("Add your Apollo API key in Settings first");
  return decryptConnectionKey(data.key_ciphertext);
}

type Person = { first_name: string; last_name: string; company: string; email: string; linkedin_url: string };
export type ApolloMatch = { email?: string | null; title?: string | null; linkedin_url?: string | null; organization?: { name?: string | null } | null; first_name?: string | null; last_name?: string | null } | null;

/** Enrich up to 10 people per call. Returns matches aligned with input order. */
export async function apolloBulkMatch(userId: string, people: Person[]): Promise<ApolloMatch[]> {
  const key = await getKey(userId);
  const res = await fetch("https://api.apollo.io/api/v1/people/bulk_match?reveal_personal_emails=false", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "X-Api-Key": key },
    body: JSON.stringify({
      details: people.slice(0, 10).map((p) => ({
        first_name: p.first_name || undefined, last_name: p.last_name || undefined,
        organization_name: p.company || undefined, email: p.email || undefined, linkedin_url: p.linkedin_url || undefined,
      })),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Apollo failed [${res.status}]: ${body}`);
    if (res.status === 401) throw new Error("Apollo rejected your API key. Check it in Settings.");
    if (res.status === 403) throw new Error("Your Apollo key can't use enrichment. Enable it in Apollo under Settings > API.");
    if (res.status === 429) throw new Error("Apollo rate limit reached. Try again in a minute.");
    throw new Error(`Apollo request failed (${res.status})`);
  }
  const json = (await res.json()) as { matches?: ApolloMatch[] };
  return json.matches ?? [];
}
