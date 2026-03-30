import type { Json } from "@/types/database";

export type OrgContextRole = {
  name: string;
  typical_day: string;
  tools: string[];
};

export type OrgContext = {
  company_description: string;
  industry: string;
  employee_count: string;
  roles: OrgContextRole[];
  application_types: string[];
  forbidden_activities: string;
  success_definition: string;
  glossary: Record<string, string>;
};

export const EMPTY_ORG_CONTEXT: OrgContext = {
  company_description: "",
  industry: "",
  employee_count: "",
  roles: [],
  application_types: [],
  forbidden_activities: "",
  success_definition: "",
  glossary: {},
};

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function asRoles(v: unknown): OrgContextRole[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      return {
        name: asString(o.name),
        typical_day: asString(o.typical_day),
        tools: asStringArray(o.tools),
      };
    })
    .filter((r): r is OrgContextRole => r !== null && r.name.length > 0);
}

function asGlossary(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "string") out[k] = val;
  }
  return out;
}

export function parseOrgContext(raw: Json | null | undefined): OrgContext {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...EMPTY_ORG_CONTEXT };
  }
  const o = raw as Record<string, unknown>;
  return {
    company_description: asString(o.company_description),
    industry: asString(o.industry),
    employee_count: asString(o.employee_count),
    roles: asRoles(o.roles),
    application_types: asStringArray(o.application_types),
    forbidden_activities: asString(o.forbidden_activities),
    success_definition: asString(o.success_definition),
    glossary: asGlossary(o.glossary),
  };
}

export function orgContextIsEmpty(ctx: OrgContext): boolean {
  return (
    ctx.company_description.trim().length < 10 &&
    ctx.roles.length === 0 &&
    ctx.application_types.length === 0
  );
}

export function getRoleDetails(
  ctx: OrgContext,
  targetRole: string,
): OrgContextRole | null {
  const t = targetRole.trim().toLowerCase();
  return (
    ctx.roles.find((r) => r.name.trim().toLowerCase() === t) ?? null
  );
}
