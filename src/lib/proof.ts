/** Matches `plan_steps.proof_type` CHECK in migration 013. */
export const PROOF_TYPES = [
  "none",
  "text",
  "link",
  "text_and_link",
  "file",
  "screenshot",
] as const;

export type ProofType = (typeof PROOF_TYPES)[number];

export type StepEvidence = {
  text?: string;
  url?: string;
  storage_path?: string;
};

export function isProofType(s: string): s is ProofType {
  return (PROOF_TYPES as readonly string[]).includes(s);
}

export function normalizeProofType(raw: unknown): ProofType {
  if (typeof raw === "string" && isProofType(raw)) return raw;
  return "none";
}

/** Default proof fields when loading legacy plans or AI output without them. */
export function defaultProofForStep(partial?: {
  proof_type?: unknown;
  proof_instructions?: unknown;
  success_criteria?: string;
}): { proof_type: ProofType; proof_instructions: string } {
  const proof_type = normalizeProofType(partial?.proof_type);
  let proof_instructions =
    typeof partial?.proof_instructions === "string"
      ? partial.proof_instructions.trim()
      : "";
  if (!proof_instructions) {
    proof_instructions =
      proof_type === "none"
        ? "No separate proof required — confirm you completed the step."
        : proof_type === "link"
          ? "Paste a link that shows your work (e.g. doc, ticket, or CRM record)."
          : proof_type === "text_and_link"
            ? "Add a short note and a link that together show you completed this step."
            : `Show how you met the success criteria: ${(partial?.success_criteria ?? "see success criteria above").slice(0, 200)}`;
  }
  return { proof_type, proof_instructions };
}

export function evidenceSatisfiesProof(
  proofType: ProofType,
  evidence: StepEvidence,
): boolean {
  const text = evidence.text?.trim() ?? "";
  const url = evidence.url?.trim() ?? "";
  const storage = evidence.storage_path?.trim() ?? "";

  switch (proofType) {
    case "none":
      return true;
    case "text":
      return text.length > 0;
    case "link":
      return isValidHttpUrl(url);
    case "text_and_link":
      return text.length > 0 && isValidHttpUrl(url);
    case "file":
    case "screenshot":
      return (
        storage.length > 0 ||
        isValidHttpUrl(url) ||
        text.length > 0
      );
    default:
      return false;
  }
}

function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
