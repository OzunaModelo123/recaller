/**
 * Bot Framework OAuth2 token acquisition and caching.
 * Uses client_credentials grant against Microsoft identity platform.
 */
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export async function getTeamsAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
  }

  const tenantId = process.env.TEAMS_TENANT_ID;
  const appId = process.env.TEAMS_APP_ID;
  const appPassword = process.env.TEAMS_APP_PASSWORD;

  if (!tenantId || !appId || !appPassword) {
    throw new Error("Missing TEAMS_TENANT_ID, TEAMS_APP_ID, or TEAMS_APP_PASSWORD");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: appId,
    client_secret: appPassword,
    scope: "https://api.botframework.com/.default",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Teams token request failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    accessToken: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  };

  return cachedToken.accessToken;
}
