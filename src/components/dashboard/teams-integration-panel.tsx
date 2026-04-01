"use client";

import { useState } from "react";
import {
  MessageSquareMore,
  Check,
  X,
  ExternalLink,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  connected: boolean;
  tenantId: string | null;
  mappedUsers: number;
  teamsResult: string | null;
  teamsReason: string | null;
  teamsOAuthUrl: string;
  publicAppOrigin: string;
  teamsEnvConfigured: boolean;
};

export function TeamsIntegrationPanel({
  connected,
  tenantId,
  mappedUsers,
  teamsResult,
  teamsReason,
  teamsOAuthUrl,
  publicAppOrigin,
  teamsEnvConfigured,
}: Props) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ mapped: number } | { error: string } | null>(null);

  const isConnected = connected && !isDisconnected;

  async function handleSyncUsers() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/teams/resync", { method: "POST" });
      const json = (await res.json()) as { ok?: boolean; mapped?: number; error?: string };
      if (res.ok && json.ok) {
        setSyncResult({ mapped: json.mapped ?? 0 });
      } else {
        setSyncResult({ error: json.error ?? "Sync failed." });
      }
    } catch {
      setSyncResult({ error: "Network error during sync." });
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (
      !confirm(
        "Disconnect Microsoft Teams? The bot will stop sending messages and employee Teams links will be cleared.",
      )
    )
      return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/teams/disconnect", { method: "POST" });
      if (res.ok) setIsDisconnected(true);
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary border border-border">
            <MessageSquareMore className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Microsoft Teams</h3>
            <p className="text-sm text-muted-foreground">
              Connect your Microsoft 365 tenant so employees can complete training plans via Adaptive Cards in Teams.
            </p>
          </div>
        </div>
        {isConnected ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <Check className="h-3 w-3" /> Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Not connected
          </span>
        )}
      </div>

      {teamsResult === "success" && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-400">
          <Check className="mr-1.5 inline h-4 w-4" />
          Microsoft Teams connected successfully! Users matched by email.
        </div>
      )}

      {teamsResult === "error" && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          <X className="mr-1.5 inline h-4 w-4" />
          {teamsReason === "missing_teams_env" ? (
            <>
              <span className="font-medium">Teams isn’t configured on the server yet.</span> In the
              Vercel project → Settings → Environment Variables (Production), add{" "}
              <code className="rounded bg-background/60 px-1 text-[11px]">TEAMS_APP_ID</code>,{" "}
              <code className="rounded bg-background/60 px-1 text-[11px]">TEAMS_TENANT_ID</code>, and{" "}
              <code className="rounded bg-background/60 px-1 text-[11px]">TEAMS_APP_PASSWORD</code>{" "}
              (Azure Bot App ID, Directory tenant ID, and client secret). Set{" "}
              <code className="rounded bg-background/60 px-1 text-[11px]">NEXT_PUBLIC_APP_URL</code>{" "}
              to your live URL (e.g. https://recaller-seven.vercel.app), then redeploy.
            </>
          ) : teamsReason === "missing_app_url" ? (
            <>
              <span className="font-medium">App URL is not set.</span> Set{" "}
              <code className="rounded bg-background/60 px-1 text-[11px]">NEXT_PUBLIC_APP_URL</code>{" "}
              in Vercel to your production origin so OAuth redirects work, then redeploy.
            </>
          ) : teamsReason === "invalid_client" ||
            teamsReason === "invalid_client_token" ||
            teamsReason?.startsWith("invalid_client:") ? (
            <>
              <span className="font-medium">Azure rejected the app (invalid client).</span> Usually
              this means the <strong>Application (client) ID</strong>,{" "}
              <strong>client secret</strong>, or <strong>redirect URI</strong> does not match what
              is configured in Microsoft Entra ID. Checklist: (1) In{" "}
              <strong>Entra ID → App registrations</strong>, open the app whose{" "}
              <em>Application (client) ID</em> equals your{" "}
              <code className="rounded bg-background/60 px-1 text-[11px]">TEAMS_APP_ID</code>. (2)
              Under <strong>Certificates &amp; secrets</strong>, create a <em>new</em> client secret
              and set <code className="rounded bg-background/60 px-1 text-[11px]">TEAMS_APP_PASSWORD</code>{" "}
              to that value in Vercel (secrets expire). (3) Under{" "}
              <strong>Authentication → Redirect URIs</strong>, add exactly:{" "}
              <code className="mt-1 block break-all rounded bg-background/60 px-1 py-1 text-[11px]">
                {publicAppOrigin}/api/teams/oauth
              </code>{" "}
              (Web platform). (4) <code className="rounded bg-background/60 px-1 text-[11px]">TEAMS_TENANT_ID</code>{" "}
              must be the <em>Directory (tenant) ID</em> of the same tenant where that app is
              registered. Then redeploy.
              {teamsReason?.startsWith("invalid_client:") ? (
                <span className="mt-2 block text-xs opacity-90">
                  Detail:{" "}
                  {(() => {
                    try {
                      return decodeURIComponent(teamsReason.slice("invalid_client:".length));
                    } catch {
                      return teamsReason.slice("invalid_client:".length);
                    }
                  })()}
                </span>
              ) : null}
            </>
          ) : (
            <>
              Teams connection failed
              {teamsReason && teamsReason !== "forbidden" ? `: ${teamsReason}` : teamsReason === "forbidden" ? ": admin only" : ""}
              . Please try again.
            </>
          )}
        </div>
      )}

      {!isConnected && !teamsEnvConfigured && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <span className="font-medium">Connect Teams is disabled</span> until{" "}
          <code className="rounded bg-background/60 px-1 text-[11px]">TEAMS_APP_ID</code> and{" "}
          <code className="rounded bg-background/60 px-1 text-[11px]">TEAMS_TENANT_ID</code> are set
          on the server (Vercel → Environment Variables → Production). Also add{" "}
          <code className="rounded bg-background/60 px-1 text-[11px]">TEAMS_APP_PASSWORD</code> for
          the bot token flow and redeploy.
        </div>
      )}

      {!isConnected && (
        <div className="mt-4 space-y-3 rounded-lg border border-amber-200/80 bg-amber-50/80 p-4 dark:border-amber-900/40 dark:bg-amber-950/30">
          <h4 className="text-sm font-semibold text-foreground">
            Before connecting
          </h4>
          <ol className="list-decimal space-y-2 pl-4 text-xs text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Create an Azure Bot</span> in the Azure
              Portal (search for "Azure Bot"). Choose "Single Tenant" and "Create new Microsoft App ID."
            </li>
            <li>
              Set the <span className="font-medium text-foreground">Messaging endpoint</span> to:{" "}
              <code className="rounded bg-background/60 px-1 text-[11px] font-mono text-foreground">
                {publicAppOrigin
                  ? `${publicAppOrigin}/api/teams/messages`
                  : "https://your-app.vercel.app/api/teams/messages"}
              </code>
            </li>
            <li>
              Copy your <span className="font-medium text-foreground">App ID</span> and create a{" "}
              <span className="font-medium text-foreground">Client Secret</span> under Certificates
              &amp; Secrets. Save both in your env as{" "}
              <code className="rounded bg-background/60 px-1 text-[11px]">TEAMS_APP_ID</code> and{" "}
              <code className="rounded bg-background/60 px-1 text-[11px]">TEAMS_APP_PASSWORD</code>.
            </li>
            <li>
              Enable the <span className="font-medium text-foreground">Microsoft Teams channel</span>{" "}
              for your bot in Azure Portal.
            </li>
          </ol>
        </div>
      )}

      {isConnected ? (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Tenant ID:</span>
            <span className="font-mono text-xs">{tenantId}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Users with Teams ID mapped:</span>
            {syncResult && "mapped" in syncResult
              ? syncResult.mapped
              : mappedUsers}
          </div>

          {syncResult && "mapped" in syncResult && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-2.5 text-sm text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-400">
              <Check className="mr-1.5 inline h-4 w-4" />
              Synced — {syncResult.mapped} user{syncResult.mapped !== 1 ? "s" : ""} matched.{" "}
              {syncResult.mapped === 0
                ? "No matching emails found. Employees with matching emails will be auto-linked when they message the bot."
                : "Employees can now receive Teams notifications."}
            </div>
          )}

          {syncResult && "error" in syncResult && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
              <X className="mr-1.5 inline h-4 w-4" />
              {syncResult.error}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncUsers}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1.5 h-3.5 w-3.5" />
              )}
              Sync Users
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={teamsOAuthUrl}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Re-authorize
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-destructive hover:text-destructive"
            >
              {disconnecting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="mr-1.5 h-3.5 w-3.5" />
              )}
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          {teamsOAuthUrl && teamsEnvConfigured ? (
            <Button size="sm" asChild>
              <a href={teamsOAuthUrl}>
                <MessageSquareMore className="mr-1.5 h-3.5 w-3.5" />
                Connect Teams
              </a>
            </Button>
          ) : !teamsOAuthUrl ? (
            <p className="text-xs text-muted-foreground">
              Set <code className="rounded bg-background/60 px-1">NEXT_PUBLIC_APP_URL</code> (or deploy
              on Vercel so <code className="rounded bg-background/60 px-1">VERCEL_URL</code> is
              available) so OAuth links can be built.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
