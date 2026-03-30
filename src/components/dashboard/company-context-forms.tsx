"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type { OrgContext, OrgContextRole } from "@/lib/ai/orgContext";
import {
  APPLICATION_PRESETS,
  EMPLOYEE_COUNT_OPTIONS,
  INDUSTRY_OPTIONS,
  ROLE_PRESETS,
  TOOL_PRESETS,
} from "@/lib/company-context/options";
import { saveCompanyContext } from "@/app/dashboard/onboarding/context/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown } from "lucide-react";

type RoleFormState = {
  typical_day: string;
  tools: string[];
  tools_other: string;
};

function defaultRoleState(): RoleFormState {
  return { typical_day: "", tools: [], tools_other: "" };
}

function glossaryFromRecord(g: Record<string, string>): { term: string; def: string }[] {
  return Object.entries(g).map(([term, def]) => ({ term, def }));
}

function initFromOrgContext(initial: OrgContext): {
  company_description: string;
  industry: string;
  industry_custom: string;
  employee_count: string;
  selectedRoles: string[];
  roleForms: Record<string, RoleFormState>;
  application_selected: string[];
  application_custom: string;
  forbidden_activities: string;
  success_definition: string;
  glossaryRows: { term: string; def: string }[];
} {
  const roleForms: Record<string, RoleFormState> = {};
  for (const r of initial.roles) {
    roleForms[r.name] = {
      typical_day: r.typical_day,
      tools: r.tools.filter((t) => TOOL_PRESETS.includes(t as (typeof TOOL_PRESETS)[number])),
      tools_other: r.tools.filter((t) => !TOOL_PRESETS.includes(t as (typeof TOOL_PRESETS)[number])).join(", "),
    };
  }
  const presetApps = initial.application_types.filter((a) =>
    (APPLICATION_PRESETS as readonly string[]).includes(a),
  );
  const customApps = initial.application_types.filter(
    (a) => !(APPLICATION_PRESETS as readonly string[]).includes(a),
  );
  return {
    company_description: initial.company_description,
    industry: INDUSTRY_OPTIONS.includes(initial.industry as (typeof INDUSTRY_OPTIONS)[number])
      ? initial.industry
      : initial.industry
        ? "Other"
        : "",
    industry_custom:
      initial.industry && !INDUSTRY_OPTIONS.includes(initial.industry as (typeof INDUSTRY_OPTIONS)[number])
        ? initial.industry
        : "",
    employee_count: initial.employee_count,
    selectedRoles: initial.roles.map((r) => r.name),
    roleForms,
    application_selected: presetApps,
    application_custom: customApps.join("\n"),
    forbidden_activities: initial.forbidden_activities,
    success_definition: initial.success_definition,
    glossaryRows:
      glossaryFromRecord(initial.glossary).length > 0
        ? glossaryFromRecord(initial.glossary)
        : [{ term: "", def: "" }],
  };
}

function buildOrgContext(state: ReturnType<typeof initFromOrgContext>): OrgContext {
  const industry =
    state.industry === "Other"
      ? state.industry_custom.trim() || "Other"
      : state.industry;

  const roles: OrgContextRole[] = state.selectedRoles.map((name) => {
    const rf = state.roleForms[name] ?? defaultRoleState();
    const extra = rf.tools_other
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const tools = [...new Set([...rf.tools, ...extra])];
    return {
      name,
      typical_day: rf.typical_day.trim(),
      tools,
    };
  });

  const application_types = [
    ...state.application_selected,
    ...state.application_custom
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  ];

  const glossary: Record<string, string> = {};
  for (const row of state.glossaryRows) {
    const t = row.term.trim();
    if (t) glossary[t] = row.def.trim();
  }

  return {
    company_description: state.company_description.trim(),
    industry,
    employee_count: state.employee_count,
    roles,
    application_types,
    forbidden_activities: state.forbidden_activities.trim(),
    success_definition: state.success_definition.trim(),
    glossary,
  };
}

export function CompanyContextOnboardingWizard({ initial }: { initial: OrgContext }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = useMemo(() => initFromOrgContext(initial), [initial]);
  const [form, setForm] = useState(base);

  const progress = (step / 4) * 100;

  const update = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const toggleRole = (name: string, on: boolean) => {
    setForm((f) => {
      const set = new Set(f.selectedRoles);
      if (on) {
        set.add(name);
      } else {
        set.delete(name);
      }
      const roleForms = { ...f.roleForms };
      if (on && !roleForms[name]) roleForms[name] = defaultRoleState();
      return { ...f, selectedRoles: [...set], roleForms };
    });
  };

  const toggleTool = (roleName: string, tool: string, on: boolean) => {
    setForm((f) => {
      const rf = f.roleForms[roleName] ?? defaultRoleState();
      const tools = new Set(rf.tools);
      if (on) tools.add(tool);
      else tools.delete(tool);
      return {
        ...f,
        roleForms: {
          ...f.roleForms,
          [roleName]: { ...rf, tools: [...tools] },
        },
      };
    });
  };

  const toggleApplication = (label: string, on: boolean) => {
    setForm((f) => {
      const s = new Set(f.application_selected);
      if (on) s.add(label);
      else s.delete(label);
      return { ...f, application_selected: [...s] };
    });
  };

  async function finish(completeOnboarding: boolean) {
    setSaving(true);
    setError(null);
    const ctx = buildOrgContext(form);
    const res = await saveCompanyContext(ctx, { completeOnboarding });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (completeOnboarding) {
      router.push("/dashboard");
      router.refresh();
    }
  }

  function validateStep1() {
    if (form.company_description.trim().length < 20) {
      setError("Company description must be at least 20 characters.");
      return false;
    }
    if (!form.industry || (form.industry === "Other" && !form.industry_custom.trim())) {
      setError("Please select or enter an industry.");
      return false;
    }
    if (!form.employee_count) {
      setError("Please select employee count.");
      return false;
    }
    setError(null);
    return true;
  }

  function validateStep2() {
    if (form.selectedRoles.length === 0) {
      setError("Select at least one role.");
      return false;
    }
    for (const r of form.selectedRoles) {
      const rf = form.roleForms[r] ?? defaultRoleState();
      if (rf.typical_day.trim().length < 20) {
        setError(`Describe a typical workday for "${r}" (at least 20 characters).`);
        return false;
      }
    }
    setError(null);
    return true;
  }

  function validateStep3() {
    if (form.application_selected.length === 0 && !form.application_custom.trim()) {
      setError("Select how training is applied at your company (or add custom lines).");
      return false;
    }
    setError(null);
    return true;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-widest text-stone-400">
          Company context
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Set up your workspace
        </h1>
        <p className="text-sm text-stone-500">
          This profile helps the AI tailor learning plans to how your company works. You can change it anytime in Settings.
        </p>
        <Progress value={progress} className="mt-4 h-2" />
        <p className="text-xs text-stone-400">Step {step} of 4</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {step === 1 && (
        <Card className="border-stone-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">About your company</CardTitle>
            <CardDescription>Basics the AI uses in every plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="cd">In 2–3 sentences, what does your company do?</Label>
              <Textarea
                id="cd"
                value={form.company_description}
                onChange={(e) => update({ company_description: e.target.value })}
                className="min-h-[120px] resize-y"
                placeholder="We help mid-market teams onboard customers faster…"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Select
                value={form.industry || undefined}
                onValueChange={(v) => update({ industry: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRY_OPTIONS.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.industry === "Other" && (
                <Input
                  placeholder="Describe your industry"
                  value={form.industry_custom}
                  onChange={(e) => update({ industry_custom: e.target.value })}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>How many employees will use Recaller?</Label>
              <Select
                value={form.employee_count || undefined}
                onValueChange={(v) => update({ employee_count: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_COUNT_OPTIONS.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                onClick={() => validateStep1() && setStep(2)}
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="border-stone-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Your team&apos;s roles</CardTitle>
            <CardDescription>Who completes training, and what does their day look like?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Roles completing training plans</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {ROLE_PRESETS.map((r) => (
                  <label
                    key={r}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-100 bg-stone-50/50 px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={form.selectedRoles.includes(r)}
                      onCheckedChange={(c) => toggleRole(r, c === true)}
                    />
                    {r}
                  </label>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="custom-role">Add another role</Label>
                  <Input
                    id="custom-role"
                    placeholder="e.g. Product Design"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = (e.target as HTMLInputElement).value.trim();
                        if (v && !form.selectedRoles.includes(v)) {
                          toggleRole(v, true);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => {
                    const el = document.getElementById("custom-role");
                    if (!(el instanceof HTMLInputElement)) return;
                    const v = el.value.trim();
                    if (v && !form.selectedRoles.includes(v)) {
                      toggleRole(v, true);
                      el.value = "";
                    }
                  }}
                >
                  Add role
                </Button>
              </div>
            </div>

            {form.selectedRoles.map((roleName) => (
              <Collapsible key={roleName} defaultOpen className="rounded-xl border border-stone-200">
                <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-stone-800 hover:bg-stone-50">
                  {roleName}
                  <ChevronDown className="h-4 w-4 text-stone-400" />
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t border-stone-100 px-4 py-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Typical workday (2–3 sentences)</Label>
                    <Textarea
                      value={form.roleForms[roleName]?.typical_day ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          roleForms: {
                            ...f.roleForms,
                            [roleName]: {
                              ...(f.roleForms[roleName] ?? defaultRoleState()),
                              typical_day: e.target.value,
                            },
                          },
                        }))
                      }
                      className="min-h-[100px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tools they use daily</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {TOOL_PRESETS.map((t) => (
                        <label
                          key={t}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={form.roleForms[roleName]?.tools.includes(t) ?? false}
                            onCheckedChange={(c) => toggleTool(roleName, t, c === true)}
                          />
                          {t}
                        </label>
                      ))}
                    </div>
                    <Input
                      placeholder="Other tools (comma-separated)"
                      value={form.roleForms[roleName]?.tools_other ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          roleForms: {
                            ...f.roleForms,
                            [roleName]: {
                              ...(f.roleForms[roleName] ?? defaultRoleState()),
                              tools_other: e.target.value,
                            },
                          },
                        }))
                      }
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}

            <div className="flex justify-between gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="button" onClick={() => validateStep2() && setStep(3)}>
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="border-stone-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">What &quot;applying training&quot; means here</CardTitle>
            <CardDescription>Ground rules for realistic, safe suggestions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <Label>When training sticks, what changes?</Label>
              <div className="grid gap-2">
                {APPLICATION_PRESETS.map((a) => (
                  <label
                    key={a}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-stone-100 bg-stone-50/50 px-3 py-2 text-sm"
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={form.application_selected.includes(a)}
                      onCheckedChange={(c) => toggleApplication(a, c === true)}
                    />
                    <span>{a}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Custom (one per line)</Label>
                <Textarea
                  value={form.application_custom}
                  onChange={(e) => update({ application_custom: e.target.value })}
                  placeholder="Other ways people apply learning…"
                  className="min-h-[72px]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>What should the AI never suggest? (optional)</Label>
              <Textarea
                value={form.forbidden_activities}
                onChange={(e) => update({ forbidden_activities: e.target.value })}
                placeholder='e.g. "Do not suggest cold-calling retail customers"'
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>What does success look like after training? (optional)</Label>
              <Textarea
                value={form.success_definition}
                onChange={(e) => update({ success_definition: e.target.value })}
                placeholder="Concrete outcomes you want to see…"
                className="min-h-[80px]"
              />
            </div>
            <div className="flex justify-between gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button type="button" onClick={() => validateStep3() && setStep(4)}>
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="border-stone-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Company language</CardTitle>
            <CardDescription>Optional — acronyms and terms the AI should use correctly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-stone-500">
              Example: QBR → Quarterly Business Review, AE → Account Executive
            </p>
            {form.glossaryRows.map((row, idx) => (
              <div key={idx} className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Term"
                  value={row.term}
                  onChange={(e) => {
                    const next = [...form.glossaryRows];
                    next[idx] = { ...next[idx]!, term: e.target.value };
                    update({ glossaryRows: next });
                  }}
                />
                <Input
                  placeholder="Definition"
                  value={row.def}
                  onChange={(e) => {
                    const next = [...form.glossaryRows];
                    next[idx] = { ...next[idx]!, def: e.target.value };
                    update({ glossaryRows: next });
                  }}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                update({ glossaryRows: [...form.glossaryRows, { term: "", def: "" }] })
              }
            >
              Add another term
            </Button>
            <div className="flex flex-wrap justify-between gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setStep(3)}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => finish(true)}
                >
                  Skip & finish
                </Button>
                <Button type="button" disabled={saving} onClick={() => finish(true)}>
                  {saving ? "Saving…" : "Finish"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function CompanyContextSettingsPanel({ initial }: { initial: OrgContext }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const base = useMemo(() => initFromOrgContext(initial), [initial]);
  const [form, setForm] = useState(base);

  const update = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const toggleRole = (name: string, on: boolean) => {
    setForm((f) => {
      const set = new Set(f.selectedRoles);
      if (on) set.add(name);
      else set.delete(name);
      const roleForms = { ...f.roleForms };
      if (on && !roleForms[name]) roleForms[name] = defaultRoleState();
      return { ...f, selectedRoles: [...set], roleForms };
    });
  };

  const toggleTool = (roleName: string, tool: string, on: boolean) => {
    setForm((f) => {
      const rf = f.roleForms[roleName] ?? defaultRoleState();
      const tools = new Set(rf.tools);
      if (on) tools.add(tool);
      else tools.delete(tool);
      return {
        ...f,
        roleForms: {
          ...f.roleForms,
          [roleName]: { ...rf, tools: [...tools] },
        },
      };
    });
  };

  const toggleApplication = (label: string, on: boolean) => {
    setForm((f) => {
      const s = new Set(f.application_selected);
      if (on) s.add(label);
      else s.delete(label);
      return { ...f, application_selected: [...s] };
    });
  };

  async function onSave() {
    setSaving(true);
    setMessage(null);
    const ctx = buildOrgContext(form);
    const res = await saveCompanyContext(ctx, { completeOnboarding: false });
    setSaving(false);
    setMessage(res.ok ? "Saved. Future plans will use this context." : res.error);
  }

  return (
    <Card className="border-stone-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">AI context</CardTitle>
        <CardDescription>
          Edit your company profile. Saving updates what the AI knows about your organization.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-10">
        {message && (
          <p className={`text-sm ${message.includes("Saved") ? "text-emerald-700" : "text-red-700"}`}>
            {message}
          </p>
        )}

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-stone-800">About your company</h3>
          <div className="space-y-2">
            <Label>What does your company do?</Label>
            <Textarea
              value={form.company_description}
              onChange={(e) => update({ company_description: e.target.value })}
              className="min-h-[100px]"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Industry</Label>
              <Select value={form.industry || undefined} onValueChange={(v) => update({ industry: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRY_OPTIONS.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.industry === "Other" && (
                <Input
                  value={form.industry_custom}
                  onChange={(e) => update({ industry_custom: e.target.value })}
                  placeholder="Custom industry"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Employees on Recaller</Label>
              <Select
                value={form.employee_count || undefined}
                onValueChange={(v) => update({ employee_count: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Range" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_COUNT_OPTIONS.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-stone-800">Roles</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {ROLE_PRESETS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.selectedRoles.includes(r)}
                  onCheckedChange={(c) => toggleRole(r, c === true)}
                />
                {r}
              </label>
            ))}
          </div>
          {form.selectedRoles.map((roleName) => (
            <div key={roleName} className="rounded-xl border border-stone-100 bg-stone-50/50 p-4 space-y-3">
              <p className="text-sm font-medium text-stone-800">{roleName}</p>
              <Textarea
                placeholder="Typical workday"
                value={form.roleForms[roleName]?.typical_day ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    roleForms: {
                      ...f.roleForms,
                      [roleName]: {
                        ...(f.roleForms[roleName] ?? defaultRoleState()),
                        typical_day: e.target.value,
                      },
                    },
                  }))
                }
              />
              <div className="flex flex-wrap gap-2">
                {TOOL_PRESETS.map((t) => (
                  <label key={t} className="flex items-center gap-1.5 text-xs">
                    <Checkbox
                      checked={form.roleForms[roleName]?.tools.includes(t) ?? false}
                      onCheckedChange={(c) => toggleTool(roleName, t, c === true)}
                    />
                    {t}
                  </label>
                ))}
              </div>
              <Input
                placeholder="Other tools (comma-separated)"
                value={form.roleForms[roleName]?.tools_other ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    roleForms: {
                      ...f.roleForms,
                      [roleName]: {
                        ...(f.roleForms[roleName] ?? defaultRoleState()),
                        tools_other: e.target.value,
                      },
                    },
                  }))
                }
              />
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-stone-800">Applying training</h3>
          <div className="grid gap-2">
            {APPLICATION_PRESETS.map((a) => (
              <label key={a} className="flex items-start gap-2 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={form.application_selected.includes(a)}
                  onCheckedChange={(c) => toggleApplication(a, c === true)}
                />
                {a}
              </label>
            ))}
          </div>
          <Textarea
            placeholder="Custom (one per line)"
            value={form.application_custom}
            onChange={(e) => update({ application_custom: e.target.value })}
          />
          <div className="space-y-2">
            <Label>Never suggest (optional)</Label>
            <Textarea
              value={form.forbidden_activities}
              onChange={(e) => update({ forbidden_activities: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Success definition (optional)</Label>
            <Textarea
              value={form.success_definition}
              onChange={(e) => update({ success_definition: e.target.value })}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-stone-800">Glossary</h3>
          {form.glossaryRows.map((row, idx) => (
            <div key={idx} className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Term"
                value={row.term}
                onChange={(e) => {
                  const next = [...form.glossaryRows];
                  next[idx] = { ...next[idx]!, term: e.target.value };
                  update({ glossaryRows: next });
                }}
              />
              <Input
                placeholder="Definition"
                value={row.def}
                onChange={(e) => {
                  const next = [...form.glossaryRows];
                  next[idx] = { ...next[idx]!, def: e.target.value };
                  update({ glossaryRows: next });
                }}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => update({ glossaryRows: [...form.glossaryRows, { term: "", def: "" }] })}
          >
            Add term
          </Button>
        </section>

        <Button type="button" disabled={saving} onClick={onSave}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </CardContent>
    </Card>
  );
}
