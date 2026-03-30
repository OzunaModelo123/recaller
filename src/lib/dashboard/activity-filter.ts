/** Whether `iso` (completion timestamp) falls in [from, to] inclusive (UTC day bounds). */
export function completionInDateRange(
  iso: string | null | undefined,
  from?: string | null,
  to?: string | null,
): boolean {
  const hasFrom = Boolean(from?.trim());
  const hasTo = Boolean(to?.trim());
  if (!hasFrom && !hasTo) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  if (hasFrom) {
    const f = new Date(`${from!.trim()}T00:00:00.000Z`).getTime();
    if (t < f) return false;
  }
  if (hasTo) {
    const e = new Date(`${to!.trim()}T23:59:59.999Z`).getTime();
    if (t > e) return false;
  }
  return true;
}
