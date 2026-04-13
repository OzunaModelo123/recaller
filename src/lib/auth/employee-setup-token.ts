import { createHmac, timingSafeEqual } from "node:crypto";

/** Long enough to finish password setup; still one-shot per page load (new token on refresh). */
const TTL_SEC = 4 * 60 * 60;

function secretKey(): string | null {
  const a = process.env.EMPLOYEE_SETUP_TOKEN_SECRET?.trim();
  if (a) return a;
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? null;
}

/**
 * Short-lived HMAC token so /employee/setup-password can call the password API without
 * relying on browser cookie ↔ Route Handler visibility (those were failing in production).
 */
export function signEmployeeSetupToken(userId: string): string {
  const secret = secretKey();
  if (!secret) {
    throw new Error("Missing EMPLOYEE_SETUP_TOKEN_SECRET or SUPABASE_SERVICE_ROLE_KEY");
  }
  const exp = Math.floor(Date.now() / 1000) + TTL_SEC;
  const payload = JSON.stringify({ u: userId, exp });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyEmployeeSetupToken(token: string): string | null {
  const secret = secretKey();
  if (!secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  try {
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }
  let parsed: { u?: string; exp?: number };
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
      u?: string;
      exp?: number;
    };
  } catch {
    return null;
  }
  if (!parsed.u || typeof parsed.exp !== "number") return null;
  if (Math.floor(Date.now() / 1000) > parsed.exp) return null;
  return parsed.u;
}
