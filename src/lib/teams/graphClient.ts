/**
 * Microsoft Graph API client for the Teams bot.
 * Uses client_credentials grant (application permissions).
 * Requires User.Read.All application permission granted in Entra ID.
 */

let cachedGraphToken: { accessToken: string; expiresAt: number } | null = null;

export async function getGraphAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedGraphToken && cachedGraphToken.expiresAt > now + 60_000) {
    return cachedGraphToken.accessToken;
  }

  const tenantId = process.env.TEAMS_TENANT_ID?.trim();
  const appId = process.env.TEAMS_APP_ID?.trim();
  const appPassword = process.env.TEAMS_APP_PASSWORD?.trim();

  if (!tenantId || !appId || !appPassword) {
    throw new Error("Missing TEAMS_TENANT_ID, TEAMS_APP_ID, or TEAMS_APP_PASSWORD");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: appId,
    client_secret: appPassword,
    scope: "https://graph.microsoft.com/.default",
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
    throw new Error(`Graph token request failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedGraphToken = {
    accessToken: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  };

  return cachedGraphToken.accessToken;
}

/**
 * Reconstructs the original email from a Microsoft guest (#EXT#) email address.
 * e.g. "john_doe_gmail.com#EXT#@tenant.onmicrosoft.com" → "john_doe@gmail.com"
 * Returns null if the email is not in #EXT# format.
 */
export function reconstructExtEmail(extEmail: string): string | null {
  const extIdx = extEmail.toLowerCase().indexOf("#ext#");
  if (extIdx === -1) return null;

  const localPlusDomain = extEmail.slice(0, extIdx);
  // The last underscore separates the original local part from the domain.
  // The part after the underscore must look like a domain (contains a dot).
  const lastUnderscore = localPlusDomain.lastIndexOf("_");
  if (lastUnderscore === -1) return null;

  const potentialDomain = localPlusDomain.slice(lastUnderscore + 1);
  if (!potentialDomain.includes(".")) return null;

  return `${localPlusDomain.slice(0, lastUnderscore)}@${potentialDomain}`;
}

/**
 * Fetches a user's mail/UPN from Microsoft Graph by their AAD Object ID.
 * Returns null if not found or on error.
 */
export async function getAadUserEmail(
  aadObjectId: string,
): Promise<{ mail: string | null; userPrincipalName: string | null } | null> {
  try {
    const token = await getGraphAccessToken();
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${aadObjectId}?$select=mail,userPrincipalName`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      console.warn(`[Graph] getAadUserEmail ${aadObjectId}: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      mail?: string;
      userPrincipalName?: string;
    };
    return {
      mail: data.mail ?? null,
      userPrincipalName: data.userPrincipalName ?? null,
    };
  } catch (err) {
    console.warn("[Graph] getAadUserEmail error", err);
    return null;
  }
}

/**
 * Lists all users in the tenant from Graph API.
 * Handles pagination automatically.
 */
export async function listAllTenantUsers(
  graphToken: string,
): Promise<{ id: string; mail?: string; userPrincipalName?: string }[]> {
  const users: { id: string; mail?: string; userPrincipalName?: string }[] = [];

  let nextLink: string | null =
    "https://graph.microsoft.com/v1.0/users?$select=id,mail,userPrincipalName&$top=100";

  while (nextLink) {
    const res = await fetch(nextLink, {
      headers: { Authorization: `Bearer ${graphToken}` },
    });

    if (!res.ok) {
      console.error("[Graph] listAllTenantUsers failed", await res.text());
      break;
    }

    const data = (await res.json()) as {
      value: { id: string; mail?: string; userPrincipalName?: string }[];
      "@odata.nextLink"?: string;
    };

    users.push(...data.value);
    nextLink = data["@odata.nextLink"] ?? null;
  }

  return users;
}
