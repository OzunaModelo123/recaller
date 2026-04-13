import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";

function planContentItemId(plans: unknown): string | null {
  if (!plans || typeof plans !== "object") return null;
  if (Array.isArray(plans)) {
    const first = plans[0] as { content_item_id?: string | null } | undefined;
    return first?.content_item_id ?? null;
  }
  return (plans as { content_item_id?: string | null }).content_item_id ?? null;
}

export const assignReviewCards = inngest.createFunction(
  {
    id: "assign-review-cards",
    name: "Assign Review Cards upon Consumption",
    triggers: [{ event: "content/consumption.completed" }],
    retries: 2,
  },
  async ({ event, step }) => {
    const { assignmentId, userId } = event.data as { assignmentId: string; userId: string };

    const assignmentData = await step.run("fetch-assignment-details", async () => {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("assignments")
        .select(`
          id,
          org_id,
          assigned_to,
          require_content_consumption,
          content_consumed,
          plans (
            id,
            content_item_id
          )
        `)
        .eq("id", assignmentId)
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Assignment not found");
      }

      if (data.assigned_to !== userId) {
        return { ok: false as const, reason: "user_mismatch" };
      }
      if (!data.require_content_consumption || !data.content_consumed) {
        return {
          ok: false as const,
          reason: "consumption_not_required_or_incomplete",
        };
      }

      const contentItemId = planContentItemId(data.plans);
      return { ok: true as const, contentItemId };
    });

    if (!assignmentData.ok) {
      return { message: `Skipped assignReviewCards: ${assignmentData.reason}` };
    }

    const contentItemId = assignmentData.contentItemId;
    if (!contentItemId) {
      return { message: "Plan has no content item attached, skipping review cards." };
    }

    const { count } = await step.run("create-review-cards", async () => {
      const admin = createAdminClient();
      
      // Get all quiz questions for this content item
      const { data: questions } = await admin
        .from("quiz_questions")
        .select("id")
        .eq("content_item_id", contentItemId);
        
      if (!questions || questions.length === 0) {
        return { count: 0 };
      }

      // Check which cards the user already has (in case of double completion)
      const { data: existingCards } = await admin
        .from("review_cards")
        .select("quiz_question_id")
        .eq("user_id", userId)
        .in("quiz_question_id", questions.map(q => q.id));
        
      const existingIds = new Set(existingCards?.map(c => c.quiz_question_id) || []);
      const newQuestionIds = questions.filter(q => !existingIds.has(q.id)).map(q => q.id);

      if (newQuestionIds.length === 0) {
        return { count: 0 };
      }

      // We make them due tomorrow morning
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(8, 0, 0, 0);

      const rowsToInsert = newQuestionIds.map(qid => ({
        user_id: userId,
        quiz_question_id: qid,
        next_review_at: tomorrow.toISOString(),
      }));

      const { error } = await admin.from("review_cards").insert(rowsToInsert);
      if (error) {
        throw new Error(`Failed to insert review cards: ${error.message}`);
      }

      return { count: rowsToInsert.length };
    });

    return { message: `Successfully assigned ${count} new review cards to user ${userId}.` };
  }
);
