"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";

import { assignPlanToEmployeeAction } from "@/app/dashboard/assignments/actions";
import type { PlanAssignCandidate } from "@/lib/dashboard/plan-assign-candidates";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function PlanAssignSheet({
  planId,
  planTitle,
  candidates,
}: {
  planId: string;
  planTitle: string;
  candidates: PlanAssignCandidate[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    candidates[0]?.userId ?? null,
  );
  const [note, setNote] = useState("");
  const [requireContentConsumption, setRequireContentConsumption] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setMessage(null);
    setNote("");
    setRequireContentConsumption(true);
    setSelectedId(candidates[0]?.userId ?? null);
  }

  function submit() {
    if (!selectedId) {
      setMessage("Select an employee.");
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const res = await assignPlanToEmployeeAction({
        planId,
        employeeUserId: selectedId,
        assignerNote: note.trim() || null,
        requireContentConsumption,
      });
      if (!res.ok) {
        setMessage(res.error);
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2 border-border shadow-[var(--shadow-xs)]">
          <UserPlus className="h-4 w-4" />
          Assign to employee
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Assign plan</SheetTitle>
          <SheetDescription>
            Choose who receives <span className="font-medium text-foreground">{planTitle}</span>.
            They will see it under My Plans and on their home dashboard. Optional note appears for
            them on the assignment.
          </SheetDescription>
        </SheetHeader>

        {candidates.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">
            No employees in your org yet. Invite people from Team, then assign this plan.
          </p>
        ) : (
          <div className="flex flex-1 flex-col gap-4 overflow-hidden px-4 pb-4">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Team members
              </Label>
              <div className="max-h-[min(52vh,420px)] space-y-2 overflow-y-auto rounded-xl border border-border bg-card p-2">
                {candidates.map((c) => {
                  const selected = c.userId === selectedId;
                  return (
                    <button
                      key={c.userId}
                      type="button"
                      onClick={() => setSelectedId(c.userId)}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                        selected
                          ? "border-primary/40 bg-primary/8 ring-1 ring-primary/20"
                          : "border-transparent bg-background/60 hover:bg-secondary/80",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.email}</p>
                        </div>
                        <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium capitalize text-foreground/80">
                          {c.role}
                        </span>
                      </div>
                      {c.title?.trim() ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Title: {c.title}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs leading-snug text-muted-foreground">
                        <span className="font-medium text-foreground/80">Current focus: </span>
                        {c.currentTask}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assigner-note">Note for employee (optional)</Label>
              <Textarea
                id="assigner-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Complete this before Friday — we’ll review on the team call."
                rows={3}
                className="resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                Shown at the top of their assignment and on the plan card in My Plans.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
               <div>
                  <Label htmlFor="require-content" className="text-sm font-semibold text-primary">Content Verification</Label>
                  <p className="text-[11px] text-muted-foreground max-w-sm mt-0.5">Require employee to watch/read the training content before unlocking steps.</p>
               </div>
               <Switch 
                  id="require-content" 
                  checked={requireContentConsumption} 
                  onCheckedChange={setRequireContentConsumption} 
               />
            </div>

            {message ? (
              <p className="text-sm text-destructive">{message}</p>
            ) : null}

            <Button
              type="button"
              className="mt-auto"
              disabled={!selectedId || pending}
              onClick={submit}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning…
                </>
              ) : (
                "Assign plan"
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
