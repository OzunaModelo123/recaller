"use client";

import { useState } from "react";
import {
  MessageSquare,
  Check,
  X,
  ExternalLink,
  Loader2,
  ClipboardCopy,
} from "lucide-react";

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
  /** Same URL for Event Subscriptions and Interactivity (from server env). */
  slackEventsUrl: string;
  slackOAuthRedirectUrl: string;
  publicAppOrigin: string;
};

function CopyUrlField({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        <Input readOnly className="min-w-0 flex-1 font-mono text-xs" value={url || "—"} />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="shrink-0"
          onClick={copy}
          disabled={!url}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <ClipboardCopy className="h-3.5 w-3.5" />
          )}
          <span className="ml-1.5">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
    </div>
  );
}

export function SlackIntegrationPanel({
  connected,
  teamId,
  mappedUsers,
  slackResult,
  slackReason,
  initialAdminChannelId,
  slackEventsUrl,
  slackOAuthRedirectUrl,
  publicAppOrigin,
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

      <div className="mt-4 space-y-3 rounded-lg border border-amber-200/80 bg-amber-50/80 p-4 dark:border-amber-900/40 dark:bg-amber-950/30">
        <h4 className="text-sm font-semibold text-foreground">
          Slack app URLs (paste into api.slack.com)
        </h4>
        <div className="rounded-md border border-border bg-background/60 p-3 text-xs leading-relaxed text-foreground">
          <p className="font-medium">Localhost vs Vercel — why you might see two different links</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">On your computer</span> (when you run
              the app locally): the address often looks like{" "}
              <span className="font-mono text-[11px] text-foreground">http://localhost:3000</span>.
              Only you can open that.{" "}
              <span className="font-medium text-foreground">Slack cannot reach it.</span>
            </li>
            <li>
              <span className="font-medium text-foreground">On the internet (Vercel)</span>: your
              real site uses an address starting with{" "}
              <span className="font-mono text-[11px] text-foreground">https://</span>
              {publicAppOrigin ? (
                <>
                  {" "}
                  (here:{" "}
                  <span className="break-all font-mono text-[11px] text-foreground">
                    {publicAppOrigin}
                  </span>
                  ).
                </>
              ) : (
                <> (your team sets this in Vercel).</>
              )}{" "}
              Slack talks to this one.
            </li>
            <li>
              For <span className="font-medium text-foreground">logging in and testing with Slack</span>,
              use your <span className="font-medium text-foreground">Vercel link</span> in the browser.
              The URLs below are for Slack’s website — always use the ones shown here (they match
              where this app is running right now).
            </li>
          </ul>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Open{" "}
          <a
            href="https://api.slack.com/apps"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            api.slack.com/apps
          </a>
          , choose your Recaller app, then:
        </p>
        <ol className="list-decimal space-y-2 pl-4 text-xs text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Event Subscriptions</span> — turn On,
            paste the Events URL below, wait for the green verified checkmark.
          </li>
          <li>
            <span className="font-medium text-foreground">Interactivity &amp; Shortcuts</span> —
            turn On, paste the <em>same</em> URL in Request URL (required for &quot;Mark step
            complete&quot; buttons).
          </li>
          <li>
            <span className="font-medium text-foreground">OAuth &amp; Permissions</span> — under
            Redirect URLs, add the OAuth redirect below (and keep your existing entries).
          </li>
        </ol>
        {!publicAppOrigin ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Set <code className="rounded bg-background/60 px-1">NEXT_PUBLIC_APP_URL</code> in Vercel
            (or <code className="rounded bg-background/60 px-1">.env.local</code>) to your live
            site, e.g. <code className="rounded bg-background/60 px-1">https://your-app.vercel.app</code>
            , then redeploy. Without it, Slack cannot call your server.
          </p>
        ) : null}
        <CopyUrlField
          label="Events + Interactivity request URL (same for both)"
          url={slackEventsUrl}
        />
        <CopyUrlField label="OAuth redirect URL" url={slackOAuthRedirectUrl} />
        <p className="text-xs leading-relaxed text-muted-foreground">
          If Slack shows &quot;Sending messages to this app has been turned off&quot;, a workspace
          admin must re-enable the app under Slack → Settings &amp; administration → Manage apps →
          Recaller → allow messaging.
        </p>
      </div>

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
