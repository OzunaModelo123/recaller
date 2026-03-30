"use client";

import { useState } from "react";
import { MessageSquare, Check, X, ExternalLink, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  connected: boolean;
  teamId: string | null;
  mappedUsers: number;
  slackResult: string | null;
  slackReason: string | null;
  initialAdminChannelId: string | null;
};

export function SlackIntegrationPanel({
  connected,
  teamId,
  mappedUsers,
  slackResult,
  slackReason,
  initialAdminChannelId,
}: Props) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [adminChannelId, setAdminChannelId] = useState(
    initialAdminChannelId ?? "",
  );
  const [savingChannel, setSavingChannel] = useState(false);
  const [channelSaved, setChannelSaved] = useState(false);

  const isConnected = connected && !isDisconnected;

  async function handleDisconnect() {
    if (
      !confirm(
        "Disconnect Slack? The bot will leave your workspace link, admin channel updates will stop, and employee Slack links will be cleared.",
      )
    )
      return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/slack/disconnect", { method: "POST" });
      if (res.ok) setIsDisconnected(true);
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSaveAdminChannel() {
    setSavingChannel(true);
    setChannelSaved(false);
    try {
      const res = await fetch("/api/slack/admin-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: adminChannelId.trim() || null,
        }),
      });
      if (res.ok) setChannelSaved(true);
    } finally {
      setSavingChannel(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary border border-border">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Slack (admin)</h3>
            <p className="text-sm text-muted-foreground">
              Install the workspace app for notifications. Step completions in Slack are only for
              employees who connect from My Plans — not from this admin connection.
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

      {slackResult === "success" && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-400">
          <Check className="mr-1.5 inline h-4 w-4" />
          Slack connected successfully!
        </div>
      )}

      {slackResult === "error" && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          <X className="mr-1.5 inline h-4 w-4" />
          Slack connection failed{slackReason ? `: ${slackReason}` : ""}. Please try again.
        </div>
      )}

      {isConnected ? (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Workspace:</span>
            {teamId}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Users with Slack ID mapped:</span>
            {mappedUsers}
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-secondary/40 p-4">
            <Label htmlFor="slack-admin-channel" className="text-foreground">
              Admin notification channel (optional)
            </Label>
            <p className="text-xs text-muted-foreground">
              Paste a channel ID (starts with C). Read-only messages when employees complete steps —
              no buttons.
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                id="slack-admin-channel"
                className="max-w-md font-mono text-sm"
                placeholder="C01234567890"
                value={adminChannelId}
                onChange={(e) => {
                  setAdminChannelId(e.target.value);
                  setChannelSaved(false);
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={savingChannel}
                onClick={handleSaveAdminChannel}
              >
                {savingChannel ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Save channel"
                )}
              </Button>
            </div>
            {channelSaved ? (
              <p className="text-xs text-green-600 dark:text-green-400">Saved.</p>
            ) : null}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/api/slack/install">
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
          <Button size="sm" asChild>
            <a href="/api/slack/install">
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
              Connect workspace
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
