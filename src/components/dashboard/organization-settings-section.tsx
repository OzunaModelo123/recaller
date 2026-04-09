"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Building2, Check, Copy, ImageUp, Trash2 } from "lucide-react";

import {
  removeOrganizationLogo,
  updateOrganizationName,
  uploadOrganizationLogo,
} from "@/app/dashboard/settings/organization-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "—";
}

export type OrganizationSettingsSectionProps = {
  orgId: string;
  initialName: string;
  initialLogoUrl: string | null;
  industry: string | null;
  size: string | null;
};

export function OrganizationSettingsSection({
  orgId,
  initialName,
  initialLogoUrl,
  industry,
  size,
}: OrganizationSettingsSectionProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  function refreshAfterOk() {
    router.refresh();
  }

  function handleSaveName() {
    setError(null);
    setNameSaved(false);
    startTransition(async () => {
      const result = await updateOrganizationName(name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
      refreshAfterOk();
    });
  }

  function handlePickFile() {
    const input = fileRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const result = await uploadOrganizationLogo(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      refreshAfterOk();
    });
  }

  function handleRemoveLogo() {
    setError(null);
    startTransition(async () => {
      const result = await removeOrganizationLogo();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      refreshAfterOk();
    });
  }

  async function handleCopyId() {
    try {
      await navigator.clipboard.writeText(orgId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  const metaLine = [industry, size].filter(Boolean).join(" · ");

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary">
        <Building2 className="h-5 w-5 text-primary" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">Organization</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Manage your org display name and logo. Industry and team size for AI plans are edited in
        Company context.
      </p>

      {error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex flex-col items-start gap-3">
          <div
            className={cn(
              "relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted",
              initialLogoUrl && "bg-muted/20",
            )}
          >
            {initialLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- dynamic Supabase public URL
              <img
                src={initialLogoUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-lg font-semibold text-muted-foreground">
                {initialsFromName(initialName)}
              </span>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={handleFileChange}
            aria-hidden
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-xl"
              onClick={handlePickFile}
              disabled={isPending}
            >
              <ImageUp className="mr-2 h-4 w-4" />
              {initialLogoUrl ? "Change logo" : "Upload logo"}
            </Button>
            {initialLogoUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 rounded-xl text-muted-foreground"
                onClick={handleRemoveLogo}
                disabled={isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </Button>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <Label htmlFor="org-name" className="text-xs">
              Organization name
            </Label>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="max-w-md"
                autoComplete="organization"
                disabled={isPending}
              />
              <Button
                type="button"
                size="sm"
                className="h-9 rounded-xl"
                onClick={handleSaveName}
                disabled={isPending}
              >
                {isPending ? "Saving…" : "Save"}
              </Button>
              {nameSaved ? (
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <Check className="h-3.5 w-3.5" /> Saved
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">Org ID</span>
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                {orgId}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="h-7 w-7 shrink-0"
                onClick={handleCopyId}
                aria-label="Copy organization ID"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            {metaLine ? (
              <p className="mt-2 text-[11px] leading-relaxed">
                {metaLine}
                {" · "}
                <a
                  href="#company-context"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Edit in Company context
                </a>
              </p>
            ) : (
              <p className="mt-2 text-[11px] leading-relaxed">
                <a
                  href="#company-context"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Edit company context
                </a>{" "}
                to set industry and team size for AI.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
