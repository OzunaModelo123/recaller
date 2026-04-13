"use server";

import { createClient } from "@/lib/supabase/server";
import { calculateNextReview, gamifiedQualityScore } from "@/lib/retention/sm2-algorithm";
import { revalidatePath } from "next/cache";

export async function submitDailyRecallAnswer(
  reviewCardId: string,
  isCorrect: boolean,
  timeTakenMs: number
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  // Get the card
  const { data: card, error: cardErr } = await supabase
    .from("review_cards")
    .select("*")
    .eq("id", reviewCardId)
    .eq("user_id", user.id)
    .single();

  if (cardErr || !card) {
    throw new Error("Review card not found");
  }

  // Calculate stats
  const quality = gamifiedQualityScore(isCorrect, timeTakenMs);
  const { nextState, nextReviewAt } = calculateNextReview({
    easeFactor: card.ease_factor,
    intervalDays: card.interval_days,
    repetitions: card.repetitions,
  }, quality);

  // Update card
  const { error: updateErr } = await supabase
    .from("review_cards")
    .update({
      ease_factor: nextState.easeFactor,
      interval_days: nextState.intervalDays,
      repetitions: nextState.repetitions,
      next_review_at: nextReviewAt.toISOString(),
      last_reviewed_at: new Date().toISOString(),
    })
    .eq("id", reviewCardId);

  if (updateErr) {
    throw new Error("Failed to update review card");
  }

  // Log session
  const today = new Date().toISOString().split("T")[0];
  const { data: session } = await supabase
    .from("review_sessions")
    .select("id, cards_answered, retention_score_delta")
    .eq("user_id", user.id)
    .eq("session_date", today)
    .maybeSingle();

  // Simple scoring gamification: correct = +10, perfect = +20, wrong = -5
  const scoreDelta = isCorrect ? (quality === 5 ? 20 : 10) : -5;

  if (session) {
    await supabase.from("review_sessions").update({
      cards_answered: session.cards_answered + 1,
      retention_score_delta: session.retention_score_delta + scoreDelta,
    }).eq("id", session.id);
  } else {
    await supabase.from("review_sessions").insert({
      user_id: user.id,
      session_date: today,
      cards_answered: 1,
      retention_score_delta: scoreDelta,
    });
  }

  revalidatePath("/employee/daily-recall");
  return { success: true };
}
