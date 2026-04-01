"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ParsedRow = {
  email: string;
  fullName: string;
  role: "employee" | "admin";
};

type BulkResult = {
  ok: boolean;
  invited: number;
  skipped: number;
  errors: string[];
};

export async function bulkInviteFromCsvAction(csvText: string): Promise<BulkResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, invited: 0, skipped: 0, errors: ["Unauthorized"] };

  const { data: profile } = await supabase
    .from("users")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return { ok: false, invited: 0, skipped: 0, errors: ["Forbidden"] };
  }

  const lines = csvText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { ok: false, invited: 0, skipped: 0, errors: ["CSV must have a header row and at least one data row."] };
  }

  const header = lines[0].toLowerCase();
  const hasHeader = header.includes("email");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const rows: ParsedRow[] = [];
  const parseErrors: string[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const cols = dataLines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const email = cols[0]?.toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      parseErrors.push(`Row ${i + 2}: Invalid email "${cols[0]}"`);
      continue;
    }
    const fullName = cols[1]?.trim() || email.split("@")[0];
    const role = cols[2]?.trim().toLowerCase() === "admin" ? "admin" as const : "employee" as const;
    rows.push({ email, fullName, role });
  }

  if (rows.length === 0) {
    return { ok: false, invited: 0, skipped: 0, errors: parseErrors.length > 0 ? parseErrors : ["No valid rows found."] };
  }

  const admin = createAdminClient();
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  let invited = 0;
  let skipped = 0;
  const errors: string[] = [...parseErrors];

  for (const row of rows) {
    const { data: existingUser } = await admin
      .from("users")
      .select("id")
      .eq("email", row.email)
      .maybeSingle();

    if (existingUser) {
      skipped++;
      continue;
    }

    const { data: pendingInvite } = await supabase
      .from("invitations")
      .select("id")
      .eq("org_id", profile.org_id)
      .eq("email", row.email)
      .eq("status", "pending")
      .maybeSingle();

    if (pendingInvite) {
      await admin
        .from("invitations")
        .update({ status: "expired" })
        .eq("id", pendingInvite.id);
    }

    const { error: invErr } = await supabase.from("invitations").insert({
      org_id: profile.org_id,
      email: row.email,
      role: row.role,
      invited_by: user.id,
    });

    if (invErr) {
      errors.push(`${row.email}: ${invErr.message}`);
      continue;
    }

    const { error: authErr } = await admin.auth.admin.inviteUserByEmail(row.email, {
      redirectTo: `${baseUrl}/callback`,
      emailRedirectTo: `${baseUrl}/callback`,
      data: {
        invited_org_id: profile.org_id,
        full_name: row.fullName,
      },
    } as unknown as Record<string, unknown>);

    if (authErr) {
      errors.push(`${row.email}: ${authErr.message}`);
      await admin
        .from("invitations")
        .delete()
        .eq("org_id", profile.org_id)
        .eq("email", row.email);
      continue;
    }

    invited++;
  }

  revalidatePath("/dashboard/team");
  return { ok: true, invited, skipped, errors };
}
