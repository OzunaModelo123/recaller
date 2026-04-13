import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { transcribeContent } from "@/lib/inngest/functions/transcribeContent";
import { sendNudges } from "@/lib/inngest/functions/sendNudges";
import { weeklyDigest } from "@/lib/inngest/functions/weeklyDigest";
import { monthlyReport } from "@/lib/inngest/functions/monthlyReport";
import { generateQuizForContent } from "@/lib/inngest/functions/generateQuizForContent";
import { assignReviewCards } from "@/lib/inngest/functions/assignReviewCards";
import { dailyRecallNudge } from "@/lib/inngest/functions/dailyRecallNudge";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [transcribeContent, sendNudges, weeklyDigest, monthlyReport, generateQuizForContent, assignReviewCards, dailyRecallNudge],
});
