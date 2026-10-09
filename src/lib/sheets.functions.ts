import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getSheetsStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getSheetsConnection } = await import("@/server/sheets.server");
    const conn = await getSheetsConnection(context.userId);
    return { connected: !!conn };
  });

export const startSheetsConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const { GATEWAY_BASE_URL, SHEETS_CONNECTOR, SHEETS_SCOPES, getSheetsConnection } = await import("@/server/sheets.server");
    const clientKey = process.env["GOOGLE_SHEETS_APP_USER_CONNECTOR_CLIENT_API_KEY"];
    if (!clientKey) throw new Error("Google Sheets connection is not configured yet");
    const request = getRequest();
    if (!request) throw new Error("OAuth must start from an app request.");
    const url = new URL(request.url);
    const sandboxHost = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL("/api/oauth/google/return", sandboxHost ? `https://${sandboxHost}` : url.origin).toString();
    const existing = await getSheetsConnection(context.userId);
    const appUserId = existing?.appUserId ?? `${context.userId}:sheets:${crypto.randomUUID()}`;
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: SHEETS_CONNECTOR,
      appUserId,
      clientAPIKey: clientKey,
      returnUrl,
      connectionAPIKey: existing?.key,
      credentialsConfiguration: { scopes: SHEETS_SCOPES },
    });
    return { authorizationUrl, appUserId };
  });

export const completeSheetsConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().min(1), appUserId: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.appUserId.startsWith(context.userId)) throw new Error("Invalid connection request");
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector");
    const { GATEWAY_BASE_URL, SHEETS_CONNECTOR, saveSheetsKey } = await import("@/server/sheets.server");
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY_BASE_URL, data.code);
    if (connectorId !== SHEETS_CONNECTOR) throw new Error("Unexpected connector");
    await saveSheetsKey(context.userId, connectionAPIKey, data.appUserId);
    return { ok: true };
  });

async function requireKey(userId: string) {
  const { getSheetsConnection } = await import("@/server/sheets.server");
  const conn = await getSheetsConnection(userId);
  if (!conn) throw new Error("Connect Google Sheets first");
  return conn.key;
}

export const listMySpreadsheets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ search: z.string().max(200).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { sheetsCall, SheetsReconnectError } = await import("@/server/sheets.server");
    const key = await requireKey(context.userId);
    let q = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
    const search = data.search?.trim();
    if (search) q += ` and name contains '${search.replace(/'/g, "\\'")}'`;
    try {
      const r = await sheetsCall<{ files?: { id: string; name: string; modifiedTime?: string }[] }>(
        key,
        `/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=modifiedTime%20desc&pageSize=100&fields=files(id,name,modifiedTime)`,
      );
      return { files: r.files ?? [], reconnect: false, error: null as string | null };
    } catch (e) {
      if (e instanceof SheetsReconnectError) return { files: [], reconnect: true, error: null };
      return { files: [], reconnect: false, error: e instanceof Error ? e.message : "Failed" };
    }
  });

export const getSpreadsheetTabs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ spreadsheetId: z.string().regex(/^[A-Za-z0-9_-]+$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { sheetsCall } = await import("@/server/sheets.server");
    const key = await requireKey(context.userId);
    const r = await sheetsCall<{ properties?: { title?: string }; sheets?: { properties: { title: string } }[] }>(
      key,
      `/v4/spreadsheets/${data.spreadsheetId}?fields=properties.title,sheets.properties.title`,
    );
    return { title: r.properties?.title ?? "", tabs: (r.sheets ?? []).map((s) => s.properties.title) };
  });

export const getSheetRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ spreadsheetId: z.string().regex(/^[A-Za-z0-9_-]+$/), tab: z.string().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sheetsCall } = await import("@/server/sheets.server");
    const key = await requireKey(context.userId);
    const range = `'${data.tab.replace(/'/g, "''")}'`;
    const r = await sheetsCall<{ values?: string[][] }>(
      key,
      `/v4/spreadsheets/${data.spreadsheetId}/values/${encodeURIComponent(range)}?majorDimension=ROWS`,
    );
    return { rows: (r.values ?? []).slice(0, 10001).map((row) => row.map((c) => String(c ?? ""))) };
  });
