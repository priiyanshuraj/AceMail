// Server-only Google Sheets helpers (per-user connection via the connector gateway).
import { callAsAppUser, appUserReconnectRequired } from "@/integrations/lovable/appUserConnector";
import { encryptConnectionKey, decryptConnectionKey } from "@/server/connectionKeyCrypto";

export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
export const SHEETS_CONNECTOR = "google_sheets";
export const SHEETS_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
];

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export async function getSheetsConnection(userId: string) {
  const db = await admin();
  const { data } = await db
    .from("app_user_connections")
    .select("connection_key_ciphertext, app_user_id")
    .eq("user_id", userId)
    .eq("connector_id", SHEETS_CONNECTOR)
    .maybeSingle();
  if (!data) return null;
  return { key: decryptConnectionKey(data.connection_key_ciphertext), appUserId: data.app_user_id };
}

export async function saveSheetsKey(userId: string, key: string, appUserId: string) {
  const db = await admin();
  const { error } = await db.from("app_user_connections").upsert(
    {
      user_id: userId,
      connector_id: SHEETS_CONNECTOR,
      app_user_id: appUserId,
      connection_key_ciphertext: encryptConnectionKey(key),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,connector_id" },
  );
  if (error) throw new Error(error.message);
}

export class SheetsReconnectError extends Error {}

export async function sheetsCall<T>(key: string, path: string): Promise<T> {
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey: key,
    connectorId: SHEETS_CONNECTOR,
    path,
    requiredScopes: SHEETS_SCOPES,
  });
  if (await appUserReconnectRequired(res)) throw new SheetsReconnectError("reconnect");
  if (!res.ok) {
    const body = await res.text();
    console.error(`Sheets call failed [${res.status}] ${path}: ${body}`);
    throw new Error(`Google Sheets request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}
