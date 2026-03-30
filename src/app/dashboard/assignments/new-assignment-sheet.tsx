"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { createAssignmentsAction } from "./actions";

type PlanOpt = { id: string; title: string };
type UserOpt = { id: string; full_name: string | null; email: string };
type GroupOpt = { id: string; name: string };

export function NewAssignmentSheet({
  plans,
  employees,
  groups,
}: {
  plans: PlanOpt[];
  employees: UserOpt[];
  groups: GroupOpt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const [planId, setPlanId] = useState<string>(plans[0]?.id ?? "");
  const [mode, setMode] = useState<"individual" | "group" | "all">("individual");
  const [userId, setUserId] = useState<string>(employees[0]?.id ?? "");
  const [groupId, setGroupId] = useState<string>(groups[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");

  function reset() {
    setMessage(null);
    setPlanId(plans[0]?.id ?? "");
    setMode("individual");
    setUserId(employees[0]?.id ?? "");
    setGroupId(groups[0]?.id ?? "");
    setDueDate("");
    setScheduledFor("");
  }

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const res = await createAssignmentsAction({
        planId,
        mode,
        userId: mode === "individual" ? userId : undefined,
        groupId: mode === "group" ? groupId : undefined,
        dueDate: dueDate || null,
        scheduledFor: scheduledFor || null,
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
        <Button className="gap-1.5 shadow-[var(--shadow-button)]">
          <Plus className="h-4 w-4" />
          New assignment
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[min(100%,420px)] sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New assignment</SheetTitle>
          <SheetDescription>
            Assign a plan to one employee, a group, or everyone with the employee role.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="space-y-2">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Assign to</Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as typeof mode)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">One employee</SelectItem>
                <SelectItem value="group">Group</SelectItem>
                <SelectItem value="all">All employees</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "individual" ? (
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name?.trim() || e.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {mode === "group" ? (
            <div className="space-y-2">
              <Label>Group</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="due">Due date (optional)</Label>
            <Input
              id="due"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sched">Schedule for later (optional)</Label>
            <Input
              id="sched"
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
          </div>

          {message ? (
            <p className="text-sm text-destructive">{message}</p>
          ) : null}

          <Button
            type="button"
            disabled={
              pending ||
              !planId ||
              (mode === "individual" && !userId) ||
              (mode === "group" && !groupId) ||
              plans.length === 0 ||
              (mode === "individual" && employees.length === 0) ||
              (mode === "group" && groups.length === 0)
            }
            onClick={submit}
            className="mt-2"
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create assignment"
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
