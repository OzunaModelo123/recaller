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
  // Decode and re-check for encoded bypass attempts (e.g. %2f%2f → //)
  try {
    const decoded = decodeURIComponent(trimmed);
    if (decoded.startsWith("//") || decoded.includes("\\") || decoded.includes("\0")) {
      return fallback;
    }
  } catch {
    // Malformed encoding — reject
    return fallback;
  }
  // Block path traversal
  if (trimmed.includes("/../") || trimmed.endsWith("/..")) {
    return fallback;
  }
  // Block userinfo in path (e.g. /login@evil.com/)
  if (trimmed.includes("@")) {
    return fallback;
  }
  return trimmed;
}
