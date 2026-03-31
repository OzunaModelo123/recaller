import { verifySlackRequest } from "@slack/bolt";
import { createHandler } from "@vercel/slack-bolt";
import { after } from "next/server";

import { getApp, getReceiver } from "@/lib/slack/app";

export const maxDuration = 30;
export const runtime = "nodejs";

let _handler: ((req: Request) => Promise<Response>) | null = null;
function getHandler() {
  if (!_handler) {
    _handler = createHandler(getApp(), getReceiver());
  }
  return _handler;
}

/** Rebuild a Request with the same raw body (needed after reading body for classification). */
function cloneSlackRequest(original: Request, rawBody: string): Request {
  const headers = new Headers(original.headers);
  return new Request(original.url, {
    method: "POST",
    headers,
    body: rawBody,
  });
}

/**
 * Slack Event Subscriptions "URL verification" sends JSON { type, challenge }.
 * Answer immediately after signature check — do not wait for Bolt `app.init()` (cold starts
 * can exceed Slack's verification window and show "didn't respond with the challenge").
 */
function tryParseSlackJsonBody(
  rawBody: string,
): { type?: string; challenge?: string } | null {
  const trimmed = rawBody.trimStart();
  if (!trimmed.startsWith("{")) return null;
  try {
    return JSON.parse(trimmed) as { type?: string; challenge?: string };
  } catch {
    return null;
  }
}

function verifySlackSignatureOr401(req: Request, rawBody: string): Response | null {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return new Response("Slack signing secret not configured", { status: 500 });
  }
  const signature = req.headers.get("x-slack-signature");
  const timestamp = req.headers.get("x-slack-request-timestamp");
  if (!signature || !timestamp) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    verifySlackRequest({
      signingSecret,
      body: rawBody,
      headers: {
        "x-slack-signature": signature,
        "x-slack-request-timestamp": Number.parseInt(timestamp, 10),
      },
    });
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

/**
 * Bolt runs authorize() before ack(). On cold starts that often exceeds Slack's 3s limit,
 * so Slack shows "This app returned an error." For payloads that only need an empty 200 ack,
 * we return immediately and process in `after()` so authorize + listeners run after Slack is happy.
 */
/** Detect Slack interaction type without relying on a perfect Content-Type header. */
function slackInteractionTypeFromBody(
  rawBody: string,
  contentType: string,
): string | undefined {
  const ct = (contentType ?? "").toLowerCase();
  const looksForm =
    ct.includes("application/x-www-form-urlencoded") ||
    rawBody.trimStart().startsWith("payload=");
  if (looksForm) {
    try {
      const params = new URLSearchParams(rawBody);
      const payloadStr = params.get("payload");
      if (payloadStr) {
        const parsed = JSON.parse(payloadStr) as { type?: string };
        return parsed.type;
      }
      if (params.has("command")) return "slash_command";
    } catch {
      return undefined;
    }
  }
  if (ct.includes("application/json")) {
    try {
      const parsed = JSON.parse(rawBody) as { type?: string };
      return parsed.type;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function shouldAckImmediatelyThenProcessInBackground(
  rawBody: string,
  contentType: string,
): boolean {
  const interactionType = slackInteractionTypeFromBody(rawBody, contentType);
  if (interactionType === "block_actions") return true;
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("application/x-www-form-urlencoded")) {
    try {
      const params = new URLSearchParams(rawBody);
      if (params.has("command")) return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const authErr = verifySlackSignatureOr401(req, rawBody);
  if (authErr) return authErr;

  const jsonBody = tryParseSlackJsonBody(rawBody);
  if (
    jsonBody?.type === "url_verification" &&
    typeof jsonBody.challenge === "string"
  ) {
    return Response.json({ challenge: jsonBody.challenge });
  }

  const contentType = req.headers.get("content-type") ?? "";
  const forward = cloneSlackRequest(req, rawBody);

  const handler = getHandler();

  if (shouldAckImmediatelyThenProcessInBackground(rawBody, contentType)) {
    after(async () => {
      try {
        await handler(forward);
      } catch (e) {
        console.error("[Slack events] background handler failed", e);
      }
    });
    return new Response(null, { status: 200 });
  }

  return handler(forward);
}
