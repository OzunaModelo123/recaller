import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificationService } from "@/lib/notifications/NotificationService";

function orgIdFromUsersJoin(users: unknown): string | undefined {
  if (!users || typeof users !== "object") return undefined;
  if (Array.isArray(users)) {
    const row = users[0] as { org_id?: string } | undefined;
    return row?.org_id;
  }
  return (users as { org_id?: string }).org_id;
}

export const dailyRecallNudge = inngest.createFunction(
  {
    id: "daily-recall-nudge",
    name: "Daily Recall Nudge (Cron)",
    triggers: [{ cron: "0 8 * * 1-5" }], // 8 AM on weekdays (UTC)
  },
  async ({ step }) => {
    const admin = createAdminClient();

    const pendingUsers = await step.run("find-pending-users", async () => {
      // Find all users who have review_cards due today or earlier.
      // Easiest is to select distinct user_id where next_review_at <= now()
      const { data, error } = await admin
        .from("review_cards")
        .select("user_id, users(org_id)")
        .lte("next_review_at", new Date().toISOString());

      if (error || !data) return [];

      // Deduplicate by user_id
      const usersMap = new Map<string, { userId: string; orgId: string }>();
      for (const row of data) {
        if (!usersMap.has(row.user_id) && row.users) {
          const orgId = orgIdFromUsersJoin(row.users);
          if (orgId) {
            usersMap.set(row.user_id, { userId: row.user_id, orgId });
          }
        }
      }

      return Array.from(usersMap.values());
    });

    if (pendingUsers.length === 0) {
      return { message: "No pending review cards found." };
    }

    const results = await step.run("send-nudges", async () => {
      let sentCount = 0;
      for (const user of pendingUsers) {
        try {
          await notificationService.sendDailyRecallNudge(user.orgId, user.userId);
          sentCount++;
        } catch (error) {
          console.error(`Failed to send daily recall nudge to user ${user.userId}:`, error);
        }
      }
      return { sentCount };
    });

    return { message: `Sent ${results.sentCount} daily recall nudges.` };
  }
);
