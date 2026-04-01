/**
 * Maps Microsoft Graph user IDs to Recaller users in an org by email (and guest UPN reconstruction).
 * Shared by admin Teams OAuth callback and resync endpoint.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { listAllTenantUsers, reconstructExtEmail } from "@/lib/teams/graphClient";

export async function mapTeamsUsersToRecaller(
  graphToken: string,
  orgId: string,
): Promise<{ mapped: number }> {
  const sb = createAdminClient();
  const tenantUsers = await listAllTenantUsers(graphToken);
  let mapped = 0;

  for (const member of tenantUsers) {
    const rawEmail = (member.mail ?? member.userPrincipalName ?? "").toLowerCase().trim();
    if (!rawEmail) continue;

    const emailsToTry = new Set<string>([rawEmail]);
    const reconstructed = reconstructExtEmail(rawEmail);
    if (reconstructed) emailsToTry.add(reconstructed.toLowerCase());

    for (const email of emailsToTry) {
      const { count } = await sb
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .ilike("email", email);

      if ((count ?? 0) > 0) {
        await sb
          .from("users")
          .update({ teams_user_id: member.id })
          .eq("org_id", orgId)
          .ilike("email", email);
        mapped++;
        break;
      }
    }
  }

  return { mapped };
}
