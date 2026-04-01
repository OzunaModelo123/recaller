import { createHmac, timingSafeEqual } from "node:crypto";

type TeamsStatePayload =
  | { mode: "admin_install"; orgId: string; userId: string; exp: number }
  | { mode: "employee_link"; uid: string; orgId: string; exp: number };

const MAX_AGE_MS = 10 * 60 * 1000;

function getSecret(): string {
  const secret =
    process.env.TEAMS_STATE_SECRET?.trim() ||
    process.env.SLACK_STATE_SECRET?.trim();
  if (!secret) {
    throw new Error("TEAMS_STATE_SECRET or SLACK_STATE_SECRET is required for Teams OAuth");
  }
  return secret;
}

function signBody(body: string) {
  return createHmac("sha256", getSecret()).update(body).digest("hex");
}

export function signTeamsAdminInstallState(orgId: string, userId: string) {
  const payload: TeamsStatePayload = {
    mode: "admin_install",
    orgId,
    userId,
    exp: Date.now() + MAX_AGE_MS,
  };
  const body = JSON.stringify(payload);
  return Buffer.from(JSON.stringify({ body, sig: signBody(body) }), "utf8").toString("base64url");
}

export function signTeamsEmployeeLinkState(uid: string, orgId: string) {
  const payload: TeamsStatePayload = {
    mode: "employee_link",
    uid,
    orgId,
    exp: Date.now() + MAX_AGE_MS,
  };
  const body = JSON.stringify(payload);
  return Buffer.from(JSON.stringify({ body, sig: signBody(body) }), "utf8").toString("base64url");
}

export function verifyTeamsOAuthState(state: string | null): TeamsStatePayload | null {
  if (!state) return null;

  try {
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as { body: string; sig: string };
    const actual = Buffer.from(parsed.sig, "utf8");
    const expected = Buffer.from(signBody(parsed.body), "utf8");

    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return null;
    }

    const payload = JSON.parse(parsed.body) as Partial<TeamsStatePayload>;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) {
      return null;
    }

    if (
      payload.mode === "admin_install" &&
      typeof payload.orgId === "string" &&
      typeof payload.userId === "string"
    ) {
      return payload as TeamsStatePayload;
    }

    if (
      payload.mode === "employee_link" &&
      typeof payload.uid === "string" &&
      typeof payload.orgId === "string"
    ) {
      return payload as TeamsStatePayload;
    }

    return null;
  } catch {
    return null;
  }
}
