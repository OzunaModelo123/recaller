import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { transcribeContent } from "@/lib/inngest/functions/transcribeContent";
import { sendNudges } from "@/lib/inngest/functions/sendNudges";
import { weeklyDigest } from "@/lib/inngest/functions/weeklyDigest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [transcribeContent, sendNudges, weeklyDigest],
});
