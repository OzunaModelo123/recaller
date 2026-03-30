/** PostgREST may return a nested row as object or single-element array — normalize to one row. */
export function unwrapRelation<T>(
  v: T | T[] | null | undefined,
): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
