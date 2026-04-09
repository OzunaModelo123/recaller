/** Org branding: name + logo (settings UI). */

export const ORG_LOGOS_BUCKET = "org-logos" as const;
export const ORG_LOGO_MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED_LOGO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateOrgName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim();
  if (name.length < 1) return { ok: false, error: "Organization name is required." };
  if (name.length > 120) return { ok: false, error: "Organization name must be 120 characters or fewer." };
  return { ok: true, name };
}

export function logoExtensionForMime(mime: string): string | null {
  return ALLOWED_LOGO_TYPES[mime] ?? null;
}

export function validateLogoFile(file: File):
  | { ok: true; extension: string }
  | { ok: false; error: string } {
  if (!file.size || file.size > ORG_LOGO_MAX_BYTES) {
    return { ok: false, error: "Logo must be 2MB or smaller." };
  }
  const extension = logoExtensionForMime(file.type);
  if (!extension) {
    return { ok: false, error: "Use a PNG, JPEG, or WebP image." };
  }
  return { ok: true, extension };
}

/** Path inside bucket, e.g. `uuid/logo.jpg`, from Supabase public object URL. */
export function orgLogoObjectPathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const marker = "/object/public/org-logos/";
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const rest = url.slice(i + marker.length);
  const q = rest.indexOf("?");
  return q === -1 ? rest : rest.slice(0, q);
}

export function candidateLogoObjectPaths(orgId: string): string[] {
  return ["jpg", "jpeg", "png", "webp"].map((ext) => `${orgId}/logo.${ext}`);
}
