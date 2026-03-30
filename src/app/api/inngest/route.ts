import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { transcribeContent } from "@/lib/inngest/functions/transcribeContent";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [transcribeContent],
});
