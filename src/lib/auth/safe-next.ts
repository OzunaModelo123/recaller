export function sanitizeInternalNext(next: string | null | undefined, fallback = "/post-login") {
  if (!next) return fallback;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallback;
  }
  // Block protocol-relative and odd encodings that could confuse browsers
  if (trimmed.includes("\\") || trimmed.includes("\0")) {
    return fallback;
  }
  return trimmed;
}
