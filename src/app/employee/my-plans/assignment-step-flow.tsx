"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CompletionAnimation } from "@/components/employee/CompletionAnimation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { ProofType } from "@/lib/proof";
import { evidenceSatisfiesProof } from "@/lib/proof";
import { ChevronDown, ChevronUp, Lock } from "lucide-react";

export type EmployeePlanStep = {
  step_number: number;
  title: string;
  instructions: string;
  success_criteria: string;
  video_timestamp_start: number | null;
  video_timestamp_end: number | null;
  estimated_minutes: number | null;
  proof_type: ProofType;
  proof_instructions: string;
};

type Props = {
  assignmentId: string;
  planTitle: string;
  steps: EmployeePlanStep[];
  initialCompleted: number[];
  videoWatchBaseUrl: string | null;
};

export function AssignmentStepFlow({
  assignmentId,
  planTitle,
  steps,
  initialCompleted,
  videoWatchBaseUrl,
}: Props) {
  const router = useRouter();
  const [completed, setCompleted] = useState<Set<number>>(
    () => new Set(initialCompleted),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [note, setNote] = useState("");
  const [difficulty, setDifficulty] = useState<number | "">("");
  const [evidenceText, setEvidenceText] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");

  const sorted = useMemo(
    () => [...steps].sort((a, b) => a.step_number - b.step_number),
    [steps],
  );
  const total = sorted.length;
  const doneCount = completed.size;

  const currentStep = useMemo(() => {
    for (const s of sorted) {
      if (!completed.has(s.step_number)) return s;
    }
    return null;
  }, [sorted, completed]);

  const progressPct = total > 0 ? (doneCount / total) * 100 : 0;

  function watchUrlForStep(s: EmployeePlanStep): string | null {
    if (!videoWatchBaseUrl) return null;
    const start = s.video_timestamp_start && s.video_timestamp_start > 0
      ? s.video_timestamp_start
      : null;
    if (videoWatchBaseUrl.includes("youtube.com") || videoWatchBaseUrl.includes("youtu.be")) {
      const sep = videoWatchBaseUrl.includes("?") ? "&" : "?";
      return start != null ? `${videoWatchBaseUrl}${sep}t=${start}` : videoWatchBaseUrl;
    }
    return videoWatchBaseUrl;
  }

  async function onComplete() {
    if (!currentStep) return;
    const ev = {
      text: evidenceText.trim() || undefined,
      url: evidenceUrl.trim() || undefined,
    };
    if (!evidenceSatisfiesProof(currentStep.proof_type, ev)) {
      setError("Add the required proof for this step (see instructions).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          stepNumber: currentStep.step_number,
          platform: "web",
          note: note.trim() || undefined,
          difficultyRating:
            typeof difficulty === "number" ? difficulty : undefined,
          evidence: ev,
        }),
      });
      const data = (await res.json()) as { error?: string; assignmentStatus?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save");
        setBusy(false);
        return;
      }
      const next = new Set(completed);
      next.add(currentStep.step_number);
      setCompleted(next);
      setNote("");
      setDifficulty("");
      setEvidenceText("");
      setEvidenceUrl("");
      router.refresh();
      if (next.size >= total) {
        setCelebrate(true);
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    currentStep &&
    evidenceSatisfiesProof(currentStep.proof_type, {
      text: evidenceText,
      url: evidenceUrl,
    });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {celebrate && (
        <CompletionAnimation
          planTitle={planTitle}
          onDismiss={() => setCelebrate(false)}
        />
      )}

      <div>
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">
          {planTitle}
        </h1>
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-xs text-stone-500">
            <span>
              Progress: {doneCount} / {total}
            </span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
      </div>

      {currentStep && (
        <Card className="border-stone-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base leading-snug">
              Step {currentStep.step_number}: {currentStep.title}
            </CardTitle>
            {currentStep.estimated_minutes != null && (
              <p className="text-xs text-stone-500">
                About {currentStep.estimated_minutes} min
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="whitespace-pre-wrap text-sm text-stone-700">
              {currentStep.instructions}
            </p>
            <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-stone-800">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900/80">
                Success criteria
              </p>
              <p className="mt-1 whitespace-pre-wrap">{currentStep.success_criteria}</p>
            </div>
            <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-stone-800">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-900/80">
                Proof for Recaller
              </p>
              <p className="mt-1 whitespace-pre-wrap">{currentStep.proof_instructions}</p>
            </div>
            {watchUrlForStep(currentStep) && (
              <a
                href={watchUrlForStep(currentStep)!}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-sm font-medium text-sky-700 underline underline-offset-2"
              >
                Watch relevant video section
              </a>
            )}

            {(currentStep.proof_type === "text" ||
              currentStep.proof_type === "text_and_link" ||
              currentStep.proof_type === "file" ||
              currentStep.proof_type === "screenshot") && (
              <div className="space-y-2">
                <Label htmlFor="ev-text">
                  {currentStep.proof_type === "text_and_link"
                    ? "Notes / description"
                    : "Your proof (text)"}
                </Label>
                <Textarea
                  id="ev-text"
                  className="min-h-[100px]"
                  value={evidenceText}
                  onChange={(e) => setEvidenceText(e.target.value)}
                  placeholder="What you did, observed, or produced"
                />
              </div>
            )}

            {(currentStep.proof_type === "link" ||
              currentStep.proof_type === "text_and_link") && (
              <div className="space-y-2">
                <Label htmlFor="ev-url">Link (https://)</Label>
                <Input
                  id="ev-url"
                  type="url"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  placeholder="https://"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="note">Optional note</Label>
              <Textarea
                id="note"
                className="min-h-[60px]"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Difficulty (1–5)</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={difficulty === "" ? "" : difficulty}
                onChange={(e) => {
                  const v = e.target.value;
                  setDifficulty(v === "" ? "" : Number(v));
                }}
                className="max-w-[120px]"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button
              type="button"
              className="h-12 w-full rounded-xl bg-emerald-600 text-base hover:bg-emerald-700"
              disabled={busy || !canSubmit}
              onClick={() => void onComplete()}
            >
              {busy ? "Saving…" : "Mark step complete"}
            </Button>
          </CardContent>
        </Card>
      )}

      {!currentStep && total > 0 && (
        <p className="text-center text-sm font-medium text-emerald-700">
          You&apos;ve completed every step for this plan.
        </p>
      )}

      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 text-sm text-stone-500"
        onClick={() => setShowAll((v) => !v)}
      >
        {showAll ? (
          <>
            <ChevronUp className="h-4 w-4" /> Hide all steps
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4" /> View all steps
          </>
        )}
      </button>

      {showAll && (
        <div className="space-y-3">
          {sorted.map((s) => {
            const done = completed.has(s.step_number);
            const upcoming =
              currentStep != null &&
              !done &&
              s.step_number > currentStep.step_number;
            return (
              <Card
                key={s.step_number}
                className={`border-stone-200 ${upcoming ? "opacity-60" : ""}`}
              >
                <CardHeader className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm">
                      Step {s.step_number}: {s.title}
                    </CardTitle>
                    {done && (
                      <span className="text-xs font-medium text-emerald-600">Done</span>
                    )}
                    {upcoming && (
                      <Lock className="h-4 w-4 shrink-0 text-stone-400" aria-hidden />
                    )}
                  </div>
                </CardHeader>
                {!upcoming && (
                  <CardContent className="pt-0 text-xs text-stone-600">
                    <p className="line-clamp-4 whitespace-pre-wrap">{s.instructions}</p>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
