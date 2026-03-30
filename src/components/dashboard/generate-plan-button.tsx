"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles } from "lucide-react";

type NdjsonLine =
  | { type: "progress"; stage?: string; detail?: string }
  | {
      type: "complete";
      planId: string;
      validationWarning?: boolean;
      orgContextIncomplete?: boolean;
    }
  | { type: "error"; message: string };

export function GeneratePlanButton({
  contentItemId,
  disabled,
  targetRole,
}: {
  contentItemId: string;
  disabled?: boolean;
  targetRole?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setWarn(null);
    setStage("Starting…");

    try {
      const res = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentItemId,
          ...(targetRole ? { targetRole } : {}),
        }),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? `Error ${res.status}`);
        setStage(null);
        setBusy(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("No response body");
        setBusy(false);
        return;
      }

      const dec = new TextDecoder();
      let buf = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let msg: NdjsonLine;
          try {
            msg = JSON.parse(line) as NdjsonLine;
          } catch {
            continue;
          }
          if (msg.type === "progress") {
            setStage(msg.detail ?? msg.stage ?? "Working…");
          }
          if (msg.type === "error") {
            setError(msg.message);
            setStage(null);
            setBusy(false);
            return;
          }
          if (msg.type === "complete") {
            const parts: string[] = [];
            if (msg.validationWarning) {
              parts.push(
                "Quality checks flagged this draft. Review and edit before publishing.",
              );
            }
            if (msg.orgContextIncomplete) {
              parts.push(
                "Your company context is thin — add detail in Settings → AI context for stronger plans.",
              );
            }
            if (parts.length) setWarn(parts.join(" "));
            setStage("Done!");
            router.push(`/dashboard/plans/${msg.planId}`);
            router.refresh();
            setBusy(false);
            return;
          }
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        disabled={disabled || busy}
        onClick={run}
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        {busy ? "Generating…" : "Generate plan"}
      </Button>
      {busy && stage && (
        <div className="space-y-2">
          <p className="text-xs text-stone-500">{stage}</p>
          <Progress value={66} className="h-1.5 animate-pulse" />
        </div>
      )}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {warn && !busy && (
        <p className="text-sm text-amber-700">{warn}</p>
      )}
    </div>
  );
}
