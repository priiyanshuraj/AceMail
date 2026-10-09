// Server-only Google Sheets + Drive helpers (per-user connections via the connector gateway).
import { callAsAppUser, appUserReconnectRequired } from "@/integrations/lovable/appUserConnector";
import { encryptConnectionKey, decryptConnectionKey } from "@/server/connectionKeyCrypto";

export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
export const SHEETS_CONNECTOR = "google_sheets";
export const DRIVE_CONNECTOR = "google_drive";
export const SHEETS_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
];
export const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
];

export type GoogleConnector = typeof SHEETS_CONNECTOR | typeof DRIVE_CONNECTOR;

export function scopesFor(connector: GoogleConnector) {
  return connector === DRIVE_CONNECTOR ? DRIVE_SCOPES : SHEETS_SCOPES;
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export async function getConnection(userId: string, connector: GoogleConnector) {
  const db = await admin();
  const { data } = await db
    .from("app_user_connections")
    .select("connection_key_ciphertext, app_user_id")
    .eq("user_id", userId)
    .eq("connector_id", connector)
    .maybeSingle();
  if (!data) return null;
  return { key: decryptConnectionKey(data.connection_key_ciphertext), appUserId: data.app_user_id };
}

export async function saveKey(userId: string, connector: GoogleConnector, key: string, appUserId: string) {
  const db = await admin();
  const { error } = await db.from("app_user_connections").upsert(
    {
      user_id: userId,
      connector_id: connector,
      app_user_id: appUserId,
      connection_key_ciphertext: encryptConnectionKey(key),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,connector_id" },
  );
  if (error) throw new Error(error.message);
}

export const getSheetsConnection = (userId: string) => getConnection(userId, SHEETS_CONNECTOR);

export class SheetsReconnectError extends Error {}

export async function googleCall<T>(connector: GoogleConnector, key: string, path: string): Promise<T> {
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey: key,
    connectorId: connector,
    path,
    requiredScopes: scopesFor(connector),
  });
  if (await appUserReconnectRequired(res)) throw new SheetsReconnectError("reconnect");
  if (!res.ok) {
    const body = await res.text();
    console.error(`Google ${connector} call failed [${res.status}] ${path}: ${body.slice(0, 500)}`);
    throw new Error(`Google request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export const sheetsCall = <T>(key: string, path: string) => googleCall<T>(SHEETS_CONNECTOR, key, path);
