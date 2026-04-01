"use client";

import { useState, useTransition } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { bulkInviteFromCsvAction } from "@/app/dashboard/team/bulk-invite-actions";

export function BulkInvitePanel() {
  const [csvText, setCsvText] = useState("");
  const [result, setResult] = useState<{
    ok: boolean;
    invited: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText((ev.target?.result as string) ?? "");
      setResult(null);
    };
    reader.readAsText(file);
  }

  function handleSubmit() {
    if (!csvText.trim()) return;
    startTransition(async () => {
      const res = await bulkInviteFromCsvAction(csvText);
      setResult(res);
    });
  }

  const previewLines = csvText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const hasHeader =
    previewLines.length > 0 && previewLines[0].toLowerCase().includes("email");
  const dataPreview = hasHeader ? previewLines.slice(1) : previewLines;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Upload className="h-4 w-4" />
        Bulk Invite via CSV
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Upload a CSV with columns: <code>email, full_name, role</code> (role
        defaults to employee).
      </p>

      <div className="mt-3 flex items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary/80">
          <FileText className="h-3.5 w-3.5" />
          Choose CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={handleFileUpload}
          />
        </label>
        <span className="text-xs text-muted-foreground">or paste below</span>
      </div>

      <Textarea
        placeholder={`email,full_name,role\njane@acme.com,Jane Doe,employee\nbob@acme.com,Bob Smith,admin`}
        value={csvText}
        onChange={(e) => {
          setCsvText(e.target.value);
          setResult(null);
        }}
        rows={5}
        className="mt-3 font-mono text-xs"
      />

      {dataPreview.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {dataPreview.length} row{dataPreview.length !== 1 ? "s" : ""} to
          invite
        </p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={isPending || !csvText.trim()}
        size="sm"
        className="mt-3"
      >
        {isPending ? "Sending invites…" : "Send Invites"}
      </Button>

      {result && (
        <div
          className={`mt-3 rounded-lg border p-3 text-xs ${
            result.ok && result.errors.length === 0
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
              : "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200"
          }`}
        >
          <div className="flex items-center gap-1.5">
            {result.ok && result.errors.length === 0 ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5" />
            )}
            <span>
              {result.invited} invited, {result.skipped} skipped (already
              exist).
            </span>
          </div>
          {result.errors.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 pl-5">
              {result.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
