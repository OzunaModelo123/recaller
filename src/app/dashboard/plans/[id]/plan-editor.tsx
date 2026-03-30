"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

import type { ContentAnalysis } from "@/lib/ai/contentAnalyzer";
import type { ValidationResult } from "@/lib/ai/planValidator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown } from "lucide-react";

import { PROOF_TYPES } from "@/lib/proof";

import { resetPlanToDraft, savePlan, type SavePlanState } from "./actions";

type Step = SavePlanState["steps"][number];

type NdjsonLine =
  | { type: "progress"; detail?: string; stage?: string }
  | { type: "complete"; planId: string }
  | { type: "error"; message: string };

export function PlanEditor(props: {
  planId: string;
  contentItemId: string | null;
  contentReady: boolean;
  hasTranscript: boolean;
  targetRole: string | null;
  roleOptions: string[];
  title: string;
  isTemplate: boolean;
  steps: Step[];
  hasDraft: boolean;
  quality: ValidationResult | null;
  analysis: ContentAnalysis | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(props.title);
  const [steps, setSteps] = useState<Step[]>(props.steps);
  const [isTemplate, setIsTemplate] = useState(props.isTemplate);
  const [regenRole, setRegenRole] = useState(props.roleOptions[0] ?? "");
  const [genBusy, setGenBusy] = useState(false);
  const [genStage, setGenStage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const radarData = useMemo(() => {
    if (!props.quality?.scores) return [];
    const s = props.quality.scores;
    return [
      { dim: "Relevance", score: s.relevance, full: 5 },
      { dim: "Specificity", score: s.specificity, full: 5 },
      { dim: "Progress", score: s.progressiveness, full: 5 },
      { dim: "Feasible", score: s.feasibility, full: 5 },
      { dim: "Measurable", score: s.measurability, full: 5 },
    ];
  }, [props.quality]);

  function updateStep(i: number, patch: Partial<Step>) {
    setSteps((prev) => {
      const next = [...prev];
      next[i] = { ...next[i]!, ...patch };
      return next;
    });
  }

  function onSave() {
    setMessage(null);
    const numbered = steps.map((s, idx) => ({ ...s, step_number: idx + 1 }));
    startTransition(async () => {
      const res = await savePlan(props.planId, {
        title,
        steps: numbered,
        is_template: isTemplate,
      });
      setMessage(res.ok ? "Saved. Your edits train future plans." : res.error);
      if (res.ok) router.refresh();
    });
  }

  function onReset() {
    setMessage(null);
    startTransition(async () => {
      const res = await resetPlanToDraft(props.planId);
      setMessage(res.ok ? "Restored AI draft." : res.error);
      if (res.ok) router.refresh();
    });
  }

  async function onRegenerate() {
    if (!props.contentItemId || !regenRole) return;
    setGenBusy(true);
    setGenStage("Starting…");
    setMessage(null);
    try {
      const res = await fetch("/api/plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentItemId: props.contentItemId,
          targetRole: regenRole,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setMessage(j.error ?? "Regeneration failed");
        setGenBusy(false);
        setGenStage(null);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        setGenBusy(false);
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
            setGenStage(msg.detail ?? msg.stage ?? "…");
          }
          if (msg.type === "error") {
            setMessage(msg.message);
            setGenBusy(false);
            setGenStage(null);
            return;
          }
          if (msg.type === "complete") {
            router.push(`/dashboard/plans/${msg.planId}`);
            router.refresh();
            setGenBusy(false);
            setGenStage(null);
            return;
          }
        }
      }
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Failed");
    } finally {
      setGenBusy(false);
      setGenStage(null);
    }
  }

  const canRegenerate =
    props.contentItemId &&
    props.contentReady &&
    props.hasTranscript &&
    regenRole;

  return (
    <div className="space-y-8">
      {props.quality && (
        <Card className="border-stone-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quality scores</CardTitle>
            <p className="text-xs text-stone-500">
              Average {props.quality.overall_score.toFixed(1)} / 5
              {props.quality.forbidden_activity_violation && (
                <span className="ml-2 font-medium text-amber-700">
                  (Possible policy conflict flagged)
                </span>
              )}
            </p>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="h-56 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid />
                  <PolarAngleAxis dataKey="dim" tick={{ fontSize: 11 }} />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#57534e"
                    fill="#a8a29e"
                    fillOpacity={0.35}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {radarData.map((r) => (
                <div key={r.dim}>
                  <div className="mb-1 flex justify-between text-xs text-stone-600">
                    <span>{r.dim}</span>
                    <span>
                      {r.score}/{r.full}
                    </span>
                  </div>
                  <Progress value={(r.score / 5) * 100} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {props.analysis && (
        <Collapsible className="rounded-2xl border border-stone-200 bg-white shadow-sm">
          <CollapsibleTrigger className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-stone-800 hover:bg-stone-50">
            AI analysis
            <ChevronDown className="h-4 w-4 text-stone-400" />
          </CollapsibleTrigger>
          <CollapsibleContent className="border-t border-stone-100 px-5 py-4 text-sm text-stone-600">
            <p className="font-medium text-stone-700">{props.analysis.summary}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-stone-500">
              <li>Key concepts: {props.analysis.key_concepts.join(", ")}</li>
              <li>Skills: {props.analysis.skills_taught.join(", ")}</li>
              <li>Complexity: {props.analysis.complexity}</li>
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-stone-400">
            Target role
          </p>
          <p className="text-sm font-medium text-stone-800">
            {props.targetRole ?? "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-stone-500">Regenerate for role</Label>
            <Select value={regenRole} onValueChange={setRegenRole}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {props.roleOptions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={!canRegenerate || genBusy}
            onClick={onRegenerate}
          >
            {genBusy ? genStage ?? "…" : "Regenerate"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ptitle">Plan title</Label>
        <Input
          id="ptitle"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="max-w-xl"
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="tpl"
          checked={isTemplate}
          onCheckedChange={setIsTemplate}
        />
        <Label htmlFor="tpl" className="text-sm text-stone-700">
          Save as template
        </Label>
      </div>

      <div className="space-y-6">
        {steps.map((s, i) => (
          <Card key={i} className="border-stone-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-stone-800">
                Step {i + 1}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={s.title}
                  onChange={(e) => updateStep(i, { title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Instructions</Label>
                <Textarea
                  className="min-h-[140px]"
                  value={s.instructions}
                  onChange={(e) => updateStep(i, { instructions: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Success criteria</Label>
                <Textarea
                  className="min-h-[80px]"
                  value={s.success_criteria}
                  onChange={(e) => updateStep(i, { success_criteria: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs">Proof type (Recaller tracking)</Label>
                  <Select
                    value={s.proof_type}
                    onValueChange={(v) => updateStep(i, { proof_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROOF_TYPES.map((pt) => (
                        <SelectItem key={pt} value={pt}>
                          {pt.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Proof instructions (shown to employee)</Label>
                <Textarea
                  className="min-h-[72px]"
                  value={s.proof_instructions}
                  onChange={(e) =>
                    updateStep(i, { proof_instructions: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-xs">Video start (sec)</Label>
                  <Input
                    type="number"
                    value={s.video_timestamp_start ?? ""}
                    onChange={(e) =>
                      updateStep(i, {
                        video_timestamp_start: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Video end (sec)</Label>
                  <Input
                    type="number"
                    value={s.video_timestamp_end ?? ""}
                    onChange={(e) =>
                      updateStep(i, {
                        video_timestamp_end: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Est. minutes</Label>
                  <Input
                    type="number"
                    min={5}
                    value={s.estimated_minutes ?? ""}
                    onChange={(e) =>
                      updateStep(i, {
                        estimated_minutes: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {message && (
        <p
          className={`text-sm ${message.includes("Saved") || message.includes("Restored") ? "text-emerald-700" : "text-red-600"}`}
        >
          {message}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={pending} onClick={onSave}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending || !props.hasDraft}
          onClick={onReset}
        >
          Reset to AI draft
        </Button>
      </div>
    </div>
  );
}
