import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  DailyRecallWorkstation,
  type ReviewCard,
} from "@/components/employee/daily-recall/DailyRecallWorkstation";

export const metadata = {
  title: "Daily Recall | Recaller",
  description: "Your gamified daily knowledge retention review",
};

function normalizeDueCards(rows: unknown): ReviewCard[] {
  if (!Array.isArray(rows)) return [];
  const out: ReviewCard[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || !("id" in row)) continue;
    const id = String((row as { id: unknown }).id);
    const rawQ = (row as { quiz_questions?: unknown }).quiz_questions;
    const quiz = Array.isArray(rawQ) ? rawQ[0] : rawQ;
    if (!quiz || typeof quiz !== "object") continue;
    const q = quiz as Record<string, unknown>;
    const rawOpts = q.options;
    const options = Array.isArray(rawOpts)
      ? rawOpts.map((o) => String(o))
      : [];
    const rawCi = q.content_items;
    const ci = Array.isArray(rawCi) ? rawCi[0] : rawCi;
    const title =
      ci && typeof ci === "object" && "title" in ci
        ? String((ci as { title: unknown }).title ?? "")
        : "";
    out.push({
      id,
      quiz_questions: {
        question_text: String(q.question_text ?? ""),
        question_type: String(q.question_type ?? ""),
        options,
        correct_answer_index: Number(q.correct_answer_index ?? 0),
        explainer_text: String(q.explainer_text ?? ""),
        content_items: { title },
      },
    });
  }
  return out;
}

export default async function DailyRecallPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch due cards
  const { data: dueCards, error } = await supabase
    .from("review_cards")
    .select(`
      id,
      quiz_question_id,
      quiz_questions (
        id,
        question_text,
        question_type,
        options,
        correct_answer_index,
        explainer_text,
        content_items ( title )
      )
    `)
    .eq("user_id", user.id)
    .lte("next_review_at", new Date().toISOString())
    .order("next_review_at", { ascending: true })
    .limit(10); // Standard limit for a 2-minute daily recall

  if (error) {
    console.error(error);
    return <div>Failed to load review cards</div>;
  }

  // Also fetch today's session score
  const today = new Date().toISOString().split("T")[0];
  const { data: session } = await supabase
    .from("review_sessions")
    .select("cards_answered, retention_score_delta")
    .eq("user_id", user.id)
    .eq("session_date", today)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Your Daily Recall</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review these gamified cards to reinforce your knowledge.
        </p>
      </div>

      <DailyRecallWorkstation
        dueCards={normalizeDueCards(dueCards)}
        todayScore={session?.retention_score_delta || 0}
      />
    </div>
  );
}
