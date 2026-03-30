import type { Json } from "@/types/database";

/** Short label for manager feeds (truncated text, link/file hints). */
export function evidenceSummary(evidence: Json | null | undefined): string {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    return "—";
  }
  const o = evidence as Record<string, unknown>;
  const text = typeof o.text === "string" ? o.text.trim() : "";
  const url = typeof o.url === "string" ? o.url.trim() : "";
  const file = typeof o.storage_path === "string" ? o.storage_path.trim() : "";
  if (text && url) {
    const head = text.length > 36 ? `${text.slice(0, 36)}…` : text;
    return `${head} · Link`;
  }
  if (url) return "Link submitted";
  if (file) return "File attached";
  if (text) return text.length > 56 ? `${text.slice(0, 56)}…` : text;
  return "Confirmed";
}

/** Completion ratio in [0, 1]; safe when expected is 0. */
export function completionRatio(completed: number, expected: number): number {
  if (expected <= 0) return 0;
  return Math.min(1, completed / expected);
}

export function completionPercent(completed: number, expected: number): number {
  return Math.round(completionRatio(completed, expected) * 1000) / 10;
}

/** Traffic light tier from ratio in [0, 1]. */
export function trafficTier(
  ratio: number,
): "green" | "yellow" | "red" {
  if (ratio > 0.75) return "green";
  if (ratio >= 0.5) return "yellow";
  return "red";
}

export function trafficDotClass(tier: "green" | "yellow" | "red"): string {
  switch (tier) {
    case "green":
      return "bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.25)]";
    case "yellow":
      return "bg-amber-500 shadow-[0_0_0_2px_rgba(245,158,11,0.25)]";
    default:
      return "bg-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.25)]";
  }
}

export function trafficRowClass(tier: "green" | "yellow" | "red"): string {
  switch (tier) {
    case "green":
      return "border-l-[3px] border-l-emerald-500/80";
    case "yellow":
      return "border-l-[3px] border-l-amber-500/80";
    default:
      return "border-l-[3px] border-l-red-500/80";
  }
}
