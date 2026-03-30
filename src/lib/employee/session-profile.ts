import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type EmployeeSessionProfile = {
  userId: string;
  email: string | undefined;
  fullName: string;
  firstName: string;
  initials: string;
  orgName: string;
  role: string;
};

function initialsFromName(fullName: string): string {
  return fullName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Per-request cached profile + org for employee layout and pages (single round-trip when both run).
 */
export const getEmployeeSessionProfile = cache(
  async (userId: string): Promise<EmployeeSessionProfile | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.id !== userId) return null;

    const { data: row } = await supabase
      .from("users")
      .select(
        `
        role,
        full_name,
        organisations ( name )
      `,
      )
      .eq("id", userId)
      .maybeSingle();

    if (!row) return null;

    const orgName =
      row.organisations &&
      typeof row.organisations === "object" &&
      "name" in row.organisations
        ? String((row.organisations as { name: string }).name)
        : "Your organization";

    const fullName = row.full_name || user.email?.split("@")[0] || "User";
    const firstName = fullName.split(/\s+/)[0] || fullName;

    return {
      userId,
      email: user.email,
      fullName,
      firstName,
      initials: initialsFromName(fullName),
      orgName,
      role: row.role,
    };
  },
);
