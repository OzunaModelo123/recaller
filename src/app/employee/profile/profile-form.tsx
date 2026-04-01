"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileAction } from "./profile-actions";

type Props = {
  userId: string;
  initialName: string;
  initialTitle: string;
  email: string;
};

export function ProfileForm({ initialName, initialTitle, email }: Props) {
  const [name, setName] = useState(initialName);
  const [title, setTitle] = useState(initialTitle);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setSaved(false);
    startTransition(async () => {
      await updateProfileAction({ fullName: name.trim(), title: title.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <div className="max-w-md space-y-4">
      <div>
        <Label className="text-xs">Email</Label>
        <Input value={email} disabled className="mt-1 bg-muted/50" />
      </div>
      <div>
        <Label className="text-xs">Full Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <Label className="text-xs">Title / Role</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Sales Manager"
          className="mt-1"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isPending} size="sm">
          {isPending ? "Saving…" : "Save Changes"}
        </Button>
        {saved && (
          <span className="text-xs text-green-600 dark:text-green-400">
            Saved!
          </span>
        )}
      </div>
    </div>
  );
}
