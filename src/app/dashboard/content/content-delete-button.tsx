"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteContentItem } from "./actions";

type Props = {
  contentItemId: string;
  title: string;
  redirectToLibrary?: boolean;
  className?: string;
};

export function ContentDeleteButton({
  contentItemId,
  title,
  redirectToLibrary = false,
  className,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${title}"? This removes the content from the library and database.`,
    );
    if (!confirmed) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await deleteContentItem(contentItemId);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (redirectToLibrary) {
        router.push("/dashboard/content");
        router.refresh();
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={handleDelete}
        className="gap-2"
      >
        <Trash2 className="h-4 w-4" />
        {isPending ? "Deleting..." : "Delete"}
      </Button>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
