"use client";

import { useState } from "react";
import {
  MessageSquareMore,
  Check,
  X,
  Loader2,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  connected: boolean;
  tenantId: string | null;
  mappedUsers: number;
  publicAppOrigin: string;
  teamsEnvConfigured: boolean;
};

export function TeamsIntegrationPanel({
  connected,
  tenantId,
  mappedUsers,
  publicAppOrigin,
  teamsEnvConfigured,
}: Props) {
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const [newMappedCount, setNewMappedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isConnected = (connected || justConnected) && !isDisconnected;

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/teams/connect", { method: "POST" });
      const body = await res.json();

      if (!res.ok) {
        setError(body.message || body.error || "Connection failed");
        return;
      }

      setJustConnected(true);
      setNewMappedCount(body.mappedUsers ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
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
      if (res.ok) {
        setIsDisconnected(true);
        setJustConnected(false);
        setNewMappedCount(null);
      }
    } finally {
      setDisconnecting(false);
    }
  }

  const displayMappedUsers = newMappedCount ?? mappedUsers;

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

      {justConnected && !isDisconnected && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-400">
          <Check className="mr-1.5 inline h-4 w-4" />
          Microsoft Teams connected successfully!{" "}
          {displayMappedUsers > 0
            ? `${displayMappedUsers} user${displayMappedUsers !== 1 ? "s" : ""} matched by email.`
            : "No users matched by email yet — employees will be matched when they're added to your org."}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          <X className="mr-1.5 inline h-4 w-4" />
          {error}
        </div>
      )}

      {!isConnected && !teamsEnvConfigured && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mr-1.5 inline h-4 w-4" />
          <span className="font-medium">Connect Teams is disabled</span> until{" "}
          <code className="rounded bg-background/60 px-1 text-[11px]">TEAMS_APP_ID</code>,{" "}
          <code className="rounded bg-background/60 px-1 text-[11px]">TEAMS_APP_PASSWORD</code>, and{" "}
          <code className="rounded bg-background/60 px-1 text-[11px]">TEAMS_TENANT_ID</code> are set
          on the server (Vercel → Settings → Environment Variables → Production), then redeploy.
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
              Portal (search for &quot;Azure Bot&quot;). Choose &quot;Single Tenant&quot; and &quot;Create new Microsoft App ID.&quot;
            </li>
            <li>
              In <span className="font-medium text-foreground">App registrations</span> → your app →{" "}
              <span className="font-medium text-foreground">API permissions</span>, add{" "}
              <code className="rounded bg-background/60 px-1 text-[11px]">Microsoft Graph → Application → User.Read.All</code>{" "}
              and click <span className="font-medium text-foreground">&quot;Grant admin consent&quot;</span>.
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
              &amp; Secrets. Set them as{" "}
              <code className="rounded bg-background/60 px-1 text-[11px]">TEAMS_APP_ID</code> and{" "}
              <code className="rounded bg-background/60 px-1 text-[11px]">TEAMS_APP_PASSWORD</code>{" "}
              in Vercel env vars. Also set{" "}
              <code className="rounded bg-background/60 px-1 text-[11px]">TEAMS_TENANT_ID</code>{" "}
              (from Entra ID → Overview → Directory (tenant) ID).
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
            <span className="font-mono text-xs">{tenantId ?? process.env.TEAMS_TENANT_ID}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Users with Teams ID mapped:</span>
            {displayMappedUsers}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <MessageSquareMore className="mr-1.5 h-3.5 w-3.5" />
              )}
              Re-sync users
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
          {teamsEnvConfigured ? (
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <MessageSquareMore className="mr-1.5 h-3.5 w-3.5" />
              )}
              Connect Teams
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
