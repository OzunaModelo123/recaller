/**
 * SM-2 Algorithm Utility
 * 
 * Calculates the next review date and updated state for a Spaced Repetition card.
 * This is based on SuperMemo 2 logic, heavily adapted to gamify friction out of the app.
 * Instead of asking the user to rate difficulty, we calculate it automatically.
 */

export interface SM2State {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

/**
 * calculateNextReview
 * 
 * @param state - The current state of the review card
 * @param quality - The quality score (0 to 5), typically auto-calculated based on speed & correctness
 * @returns { nextState, nextReviewAt }
 */
export function calculateNextReview(
  state: SM2State,
  quality: number,
): { nextState: SM2State; nextReviewAt: Date } {
  // Enforce quality boundaries
  const q = Math.max(0, Math.min(5, quality));

  let { easeFactor, intervalDays, repetitions } = state;

  if (q >= 3) {
    // User answered correctly (or mostly correctly)
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    repetitions += 1;
  } else {
    // User failed to answer correctly
    repetitions = 0;
    intervalDays = 1; // Restart to re-train the card tomorrow
  }

  // Adjust the ease factor based on quality score.
  // Formula from SM-2: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  
  // Floor ease factor at 1.3
  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }

  // Calculate the actual Date object
  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);

  return {
    nextState: {
      easeFactor,
      intervalDays,
      repetitions,
    },
    nextReviewAt,
  };
}

/**
 * gamifiedQualityScore
 * 
 * In Recaller Gamified Recall, we don't ask the user how hard it was.
 * We calculate their score by evaluating correctness and speed.
 * 
 * @param isCorrect - Did they choose the right answer?
 * @param msTaken - Milliseconds spent before answering
 * @returns Quality score (0 to 5)
 */
export function gamifiedQualityScore(isCorrect: boolean, msTaken: number): number {
  if (!isCorrect) {
    // Complete blackout or wrong answer
    return msTaken > 15000 ? 0 : 1; 
  }

  // Answer is correct!
  if (msTaken <= 5000) {
    return 5; // Perfect response, instantaneous recall
  }
  if (msTaken <= 15000) {
    return 4; // Correct after a little thought
  }
  return 3; // Correct but struggled to remember
}
