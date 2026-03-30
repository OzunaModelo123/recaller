"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function CsvExportButton({
  filename,
  columns,
  rows,
  label = "Export CSV",
  disabled,
}: {
  filename: string;
  columns: { key: string; header: string }[];
  rows: Record<string, string | number | null | undefined>[];
  label?: string;
  disabled?: boolean;
}) {
  function download() {
    const headerLine = columns.map((c) => escapeCsvCell(c.header)).join(",");
    const lines = rows.map((row) =>
      columns.map((c) => escapeCsvCell(row[c.key])).join(","),
    );
    const csv = [headerLine, ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      disabled={disabled || rows.length === 0}
      onClick={download}
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
