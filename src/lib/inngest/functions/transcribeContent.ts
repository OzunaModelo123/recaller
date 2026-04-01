import { inngest } from "@/lib/inngest/client";
import { transcribeUploadedMedia } from "@/lib/content/transcribeUploadedMedia";

export const transcribeContent = inngest.createFunction(
  {
    id: "transcribe-content",
    name: "Transcribe uploaded media",
    triggers: [{ event: "content/transcribe.requested" }],
  },
  async ({ event, step }) => {
    const { contentItemId } = event.data as { contentItemId: string };
    await step.run("transcribe-uploaded-media", async () => {
      await transcribeUploadedMedia(contentItemId);
    });
  },
);
