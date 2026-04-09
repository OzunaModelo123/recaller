import type { PostgrestError } from "@supabase/supabase-js";

const GENERIC = "Something went wrong. Please try again.";

/** Avoid returning raw PostgREST messages (table/column names) to browsers. */
export function sanitizedPostgrestError(error: PostgrestError): string {
  if (error.code === "23505") return "This record already exists.";
  if (error.code === "23503") return "A related record is missing.";
  return GENERIC;
}

export function logPostgrestError(scope: string, error: PostgrestError): void {
  console.error(`[${scope}]`, error.code, error.message, error.details);
}
