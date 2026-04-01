/**
 * Low-level Bot Connector REST API wrapper for Microsoft Teams.
 * Uses raw fetch instead of botbuilder SDK for serverless compatibility.
 */
import { getTeamsAccessToken } from "./tokenManager";

export type Activity = {
  type: string;
  text?: string;
  attachments?: {
    contentType: string;
    content: unknown;
  }[];
  from?: { id: string; name?: string };
  recipient?: { id: string; name?: string };
  conversation?: { id: string };
  channelData?: unknown;
  [key: string]: unknown;
};

export type SendActivityResponse = { id: string };

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getTeamsAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function sendActivity(
  serviceUrl: string,
  conversationId: string,
  activity: Activity,
): Promise<SendActivityResponse> {
  const url = `${serviceUrl.replace(/\/$/, "")}/v3/conversations/${conversationId}/activities`;
  const headers = await authHeaders();

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(activity),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Teams sendActivity failed (${res.status}): ${text}`);
  }

  return (await res.json()) as SendActivityResponse;
}

export async function updateActivity(
  serviceUrl: string,
  conversationId: string,
  activityId: string,
  activity: Activity,
): Promise<void> {
  const url = `${serviceUrl.replace(/\/$/, "")}/v3/conversations/${conversationId}/activities/${activityId}`;
  const headers = await authHeaders();

  const res = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({ ...activity, id: activityId }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Teams updateActivity failed (${res.status}): ${text}`);
  }
}

export async function createConversation(
  serviceUrl: string,
  tenantId: string,
  userId: string,
): Promise<{ id: string; activityId?: string }> {
  const botId = process.env.TEAMS_APP_ID;
  if (!botId) throw new Error("Missing TEAMS_APP_ID");

  const url = `${serviceUrl.replace(/\/$/, "")}/v3/conversations`;
  const headers = await authHeaders();

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      bot: { id: botId },
      members: [{ id: userId }],
      channelData: { tenant: { id: tenantId } },
      isGroup: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Teams createConversation failed (${res.status}): ${text}`);
  }

  return (await res.json()) as { id: string; activityId?: string };
}
