"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UsersRound } from "lucide-react";

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
  addGroupMemberAction,
  createGroupAction,
  removeGroupMemberAction,
} from "./actions";

type Member = { userId: string; label: string };
type Group = { id: string; name: string; members: Member[] };
type Employee = { id: string; label: string };

export function GroupsPanel({
  groups,
  employees,
}: {
  groups: Group[];
  employees: Employee[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pendingCreate, startCreate] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const [addToGroup, setAddToGroup] = useState(groups[0]?.id ?? "");
  const [addUser, setAddUser] = useState(employees[0]?.id ?? "");
  const [pendingMember, startMember] = useTransition();

  function createGroup() {
    setMsg(null);
    startCreate(async () => {
      const res = await createGroupAction(name);
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      setName("");
      router.refresh();
    });
  }

  function addMember() {
    if (!addToGroup || !addUser) return;
    setMsg(null);
    startMember(async () => {
      const res = await addGroupMemberAction(addToGroup, addUser);
      if (!res.ok) setMsg(res.error);
      else router.refresh();
    });
  }

  function removeMember(groupId: string, userId: string) {
    setMsg(null);
    startMember(async () => {
      const res = await removeGroupMemberAction(groupId, userId);
      if (!res.ok) setMsg(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-none">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-secondary">
          <UsersRound className="h-[18px] w-[18px] text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Groups</h2>
          <p className="text-xs text-muted-foreground">
            Bundle employees for faster assignments.
          </p>
        </div>
      </div>

      <div className="space-y-6 px-6 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="gname">New group name</Label>
            <Input
              id="gname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sales onboarding"
            />
          </div>
          <Button
            type="button"
            disabled={!name.trim() || pendingCreate}
            onClick={createGroup}
            className="sm:mb-0"
          >
            {pendingCreate ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Create group"
            )}
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-background/40 p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Add member to group
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={addToGroup} onValueChange={setAddToGroup}>
              <SelectTrigger className="sm:max-w-[200px]">
                <SelectValue placeholder="Group" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={addUser} onValueChange={setAddUser}>
              <SelectTrigger className="sm:max-w-[220px]">
                <SelectValue placeholder="Employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              disabled={!addToGroup || !addUser || pendingMember}
              onClick={addMember}
            >
              Add
            </Button>
          </div>
        </div>

        {msg ? <p className="text-sm text-destructive">{msg}</p> : null}

        <div className="space-y-4">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No groups yet.</p>
          ) : (
            groups.map((g) => (
              <div
                key={g.id}
                className="rounded-xl border border-border bg-card px-4 py-3"
              >
                <p className="text-sm font-semibold text-foreground">{g.name}</p>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  {g.members.length === 0 ? (
                    <li className="text-xs">No members</li>
                  ) : (
                    g.members.map((m) => (
                      <li
                        key={m.userId}
                        className="flex items-center justify-between gap-2"
                      >
                        <span>{m.label}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          disabled={pendingMember}
                          onClick={() => removeMember(g.id, m.userId)}
                        >
                          Remove
                        </Button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
