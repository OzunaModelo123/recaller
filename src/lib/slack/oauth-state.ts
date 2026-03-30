import { createHmac, timingSafeEqual } from "crypto";

export type SlackOAuthPurpose = "admin_workspace";

type Payload = {
  orgId: string;
  userId: string;
  exp: number;
  purpose?: SlackOAuthPurpose;
};

const MAX_AGE_MS = 15 * 60 * 1000;

function getSecret(): string {
  const s = process.env.SLACK_STATE_SECRET;
  if (!s) throw new Error("SLACK_STATE_SECRET is required for Slack OAuth");
  return s;
}

export function signSlackOAuthState(
  orgId: string,
  userId: string,
  purpose: SlackOAuthPurpose = "admin_workspace",
): string {
  const payload: Payload = {
    orgId,
    userId,
    exp: Date.now() + MAX_AGE_MS,
    purpose,
  };
  const body = JSON.stringify(payload);
  const sig = createHmac("sha256", getSecret()).update(body).digest("hex");
  return Buffer.from(JSON.stringify({ body, sig }), "utf8").toString("base64url");
}

export function verifySlackOAuthState(state: string | null): Payload | null {
  if (!state) return null;
  try {
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const { body, sig } = JSON.parse(raw) as { body: string; sig: string };
    const expected = createHmac("sha256", getSecret()).update(body).digest("hex");
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(body) as Payload;
    if (typeof payload.orgId !== "string" || typeof payload.userId !== "string")
      return null;
    if (payload.exp < Date.now()) return null;
    if (
      payload.purpose !== undefined &&
      payload.purpose !== "admin_workspace"
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
