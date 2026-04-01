"use client";

import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  stepTitle: string;
  stepInstructions: string;
  estimatedMinutes: number | null;
  sourceVideoUrl?: string | null;
};

function formatDateLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatIcsDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function generateIcs(params: {
  title: string;
  description: string;
  startDate: Date;
  durationMinutes: number;
}): string {
  const end = new Date(params.startDate.getTime() + params.durationMinutes * 60_000);
  const escaped = params.description
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Recaller//Training Plan//EN",
    "BEGIN:VEVENT",
    `DTSTART:${formatIcsDate(params.startDate)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:Recaller: ${params.title}`,
    `DESCRIPTION:${escaped}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function buildGoogleCalUrl(params: {
  title: string;
  description: string;
  startDate: Date;
  durationMinutes: number;
}): string {
  const end = new Date(params.startDate.getTime() + params.durationMinutes * 60_000);
  const fmt = (d: Date) => formatIcsDate(d);
  const base = "https://calendar.google.com/calendar/render";
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `Recaller: ${params.title}`,
    details: params.description,
    dates: `${fmt(params.startDate)}/${fmt(end)}`,
  });
  return `${base}?${q.toString()}`;
}

export function AddToCalendar({
  stepTitle,
  stepInstructions,
  estimatedMinutes,
  sourceVideoUrl,
}: Props) {
  const [open, setOpen] = useState(false);
  const [startTime, setStartTime] = useState(formatDateLocal(new Date()));
  const duration = estimatedMinutes ?? 30;

  const description = [
    stepInstructions,
    sourceVideoUrl ? `\nVideo: ${sourceVideoUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  function downloadIcs() {
    const ics = generateIcs({
      title: stepTitle,
      description,
      startDate: new Date(startTime),
      durationMinutes: duration,
    });
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `recaller-${stepTitle.replace(/\s+/g, "-").toLowerCase()}.ics`;
    link.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  function openGoogleCal() {
    const url = buildGoogleCalUrl({
      title: stepTitle,
      description,
      startDate: new Date(startTime),
      durationMinutes: duration,
    });
    window.open(url, "_blank");
    setOpen(false);
  }

  return (
    <div className="relative inline-block">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="gap-1.5"
      >
        <Calendar className="h-3.5 w-3.5" />
        Add to Calendar
        <ChevronDown className="h-3 w-3" />
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-lg border border-border bg-card p-4 shadow-lg">
          <div className="space-y-3">
            <div>
              <Label className="text-xs">When</Label>
              <Input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Duration: {duration} min
            </p>
            <div className="flex flex-col gap-2">
              <Button size="sm" onClick={downloadIcs} className="w-full">
                Download .ics file
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={openGoogleCal}
                className="w-full"
              >
                Open in Google Calendar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
