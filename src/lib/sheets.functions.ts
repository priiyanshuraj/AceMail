import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const connectorSchema = z.enum(["google_sheets", "google_drive"]);

export const getSheetsStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnection } = await import("@/server/sheets.server");
    const [sheets, drive] = await Promise.all([
      getConnection(context.userId, "google_sheets"),
      getConnection(context.userId, "google_drive"),
    ]);
    return { connected: !!sheets, driveConnected: !!drive };
  });

export const startSheetsConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ connector: connectorSchema.default("google_sheets") }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const { GATEWAY_BASE_URL, scopesFor, getConnection } = await import("@/server/sheets.server");
    const clientKey =
      data.connector === "google_drive"
        ? process.env["GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY"]
        : process.env["GOOGLE_SHEETS_APP_USER_CONNECTOR_CLIENT_API_KEY"];
    if (!clientKey) throw new Error("Google connection is not configured yet");
    const request = getRequest();
    if (!request) throw new Error("OAuth must start from an app request.");
    const url = new URL(request.url);
    const sandboxHost = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL("/api/oauth/google/return", sandboxHost ? `https://${sandboxHost}` : url.origin).toString();
    const existing = await getConnection(context.userId, data.connector);
    const tag = data.connector === "google_drive" ? "drive" : "sheets";
    const appUserId = existing?.appUserId ?? `${context.userId}:${tag}:${crypto.randomUUID()}`;
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: data.connector,
      appUserId,
      clientAPIKey: clientKey,
      returnUrl,
      connectionAPIKey: existing?.key,
      credentialsConfiguration: { scopes: scopesFor(data.connector) },
    });
    return { authorizationUrl, appUserId };
  });

export const completeSheetsConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ code: z.string().min(1), appUserId: z.string().min(1), connector: connectorSchema.default("google_sheets") })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!data.appUserId.startsWith(`${context.userId}:`)) throw new Error("Invalid connection request");
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector");
    const { GATEWAY_BASE_URL, saveKey } = await import("@/server/sheets.server");
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY_BASE_URL, data.code);
    if (connectorId !== data.connector) throw new Error("Unexpected connector");
    await saveKey(context.userId, data.connector, connectionAPIKey, data.appUserId);
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
    const { googleCall, getConnection, SheetsReconnectError } = await import("@/server/sheets.server");
    const drive = await getConnection(context.userId, "google_drive");
    if (!drive) return { files: [], needsDrive: true, error: null as string | null };
    let q = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
    const search = data.search?.trim();
    if (search) q += ` and name contains '${search.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
    try {
      const r = await googleCall<{ files?: { id: string; name: string; modifiedTime?: string }[] }>(
        "google_drive",
        drive.key,
        `/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=modifiedTime%20desc&pageSize=100&fields=files(id,name,modifiedTime)`,
      );
      return { files: r.files ?? [], needsDrive: false, error: null as string | null };
    } catch (e) {
      if (e instanceof SheetsReconnectError) return { files: [], needsDrive: true, error: null };
      return { files: [], needsDrive: false, error: e instanceof Error ? e.message : "Failed" };
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
