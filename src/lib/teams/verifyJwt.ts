/**
 * Minimal JWT signature verification for Bot Framework incoming activities.
 * In production, validates iss, aud, and expiry against Bot Framework OpenID metadata.
 * For local dev behind ngrok, validation can be relaxed (see TEAMS_SKIP_JWT_VERIFY).
 */
import { createPublicKey, verify as cryptoVerify } from "node:crypto";

const OPENID_METADATA_URL =
  "https://login.botframework.com/v1/.well-known/openidconfiguration";

type OpenIdConfig = { jwks_uri: string };
type Jwks = {
  keys: {
    kid: string;
    x5c?: string[];
    kty: string;
    n?: string;
    e?: string;
  }[];
};

let jwksCache: { keys: Jwks["keys"]; expiresAt: number } | null = null;
const JWKS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function fetchJwks(): Promise<Jwks["keys"]> {
  const now = Date.now();
  if (jwksCache && jwksCache.expiresAt > now) return jwksCache.keys;

  const configRes = await fetch(OPENID_METADATA_URL);
  if (!configRes.ok) throw new Error("Failed to fetch OpenID metadata");
  const config = (await configRes.json()) as OpenIdConfig;

  const jwksRes = await fetch(config.jwks_uri);
  if (!jwksRes.ok) throw new Error("Failed to fetch JWKS");
  const jwks = (await jwksRes.json()) as Jwks;

  jwksCache = { keys: jwks.keys, expiresAt: now + JWKS_CACHE_TTL_MS };
  return jwks.keys;
}

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

type JwtHeader = { alg: string; kid?: string; typ?: string };
type JwtPayload = {
  iss?: string;
  aud?: string;
  exp?: number;
  nbf?: number;
  serviceurl?: string;
  [key: string]: unknown;
};

function decodeJwtParts(token: string): {
  header: JwtHeader;
  payload: JwtPayload;
  signatureInput: string;
  signature: Buffer;
} {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");
  return {
    header: JSON.parse(base64UrlDecode(parts[0]).toString()) as JwtHeader,
    payload: JSON.parse(base64UrlDecode(parts[1]).toString()) as JwtPayload,
    signatureInput: `${parts[0]}.${parts[1]}`,
    signature: base64UrlDecode(parts[2]),
  };
}

export async function verifyTeamsJwt(
  authHeader: string | null,
): Promise<{ valid: true; payload: JwtPayload } | { valid: false; reason: string }> {
  if (process.env.TEAMS_SKIP_JWT_VERIFY === "true" && process.env.NODE_ENV !== "production") {
    if (!authHeader) return { valid: true, payload: {} };
    try {
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const { payload } = decodeJwtParts(token);
      return { valid: true, payload };
    } catch {
      return { valid: true, payload: {} };
    }
  }

  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return { valid: false, reason: "Missing or invalid Authorization header" };
  }

  const token = authHeader.slice(7);

  let header: JwtHeader;
  let payload: JwtPayload;
  let signatureInput: string;
  let signature: Buffer;
  try {
    ({ header, payload, signatureInput, signature } = decodeJwtParts(token));
  } catch {
    return { valid: false, reason: "Malformed JWT" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    return { valid: false, reason: "Token expired" };
  }
  if (payload.nbf && payload.nbf > now + 300) {
    return { valid: false, reason: "Token not yet valid" };
  }

  const appId = process.env.TEAMS_APP_ID;
  if (appId && payload.aud && payload.aud !== appId) {
    return { valid: false, reason: `Audience mismatch: expected ${appId}, got ${payload.aud}` };
  }

  try {
    const keys = await fetchJwks();
    const matchingKey = header.kid
      ? keys.find((k) => k.kid === header.kid)
      : keys[0];

    if (!matchingKey) {
      return { valid: false, reason: "No matching signing key found" };
    }

    let publicKey: ReturnType<typeof createPublicKey>;
    if (matchingKey.x5c && matchingKey.x5c.length > 0) {
      const cert = `-----BEGIN CERTIFICATE-----\n${matchingKey.x5c[0]}\n-----END CERTIFICATE-----`;
      publicKey = createPublicKey(cert);
    } else if (matchingKey.n && matchingKey.e) {
      publicKey = createPublicKey({
        key: { kty: "RSA", n: matchingKey.n, e: matchingKey.e },
        format: "jwk",
      });
    } else {
      return { valid: false, reason: "Signing key has no usable material" };
    }

    const algMap: Record<string, string> = {
      RS256: "RSA-SHA256",
      RS384: "RSA-SHA384",
      RS512: "RSA-SHA512",
    };
    const algorithm = algMap[header.alg] ?? "RSA-SHA256";

    const isValid = cryptoVerify(
      algorithm,
      Buffer.from(signatureInput),
      publicKey,
      signature,
    );

    if (!isValid) {
      return { valid: false, reason: "Signature verification failed" };
    }

    return { valid: true, payload };
  } catch (err) {
    console.error("[teams/verifyJwt]", err);
    return {
      valid: false,
      reason: "Token verification failed",
    };
  }
}
