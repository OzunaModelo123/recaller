import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

const QuizSchema = z.object({
  questions: z.array(
    z.object({
      question_text: z.string(),
      question_type: z.enum(["multiple_choice", "true_false", "scenario"]),
      options: z.array(z.string()),
      correct_answer_index: z.number(),
      explainer_text: z.string(),
    })
  ),
});

export const generateQuizForContent = inngest.createFunction(
  {
    id: "generate-quiz-for-content",
    name: "Generate Quiz Questions using AI",
    triggers: [{ event: "content/transcription.completed" }],
    retries: 2,
  },
  async ({ event, step }) => {
    const { contentItemId } = event.data as { contentItemId: string };

    const contentItem = await step.run("fetch-content", async () => {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("content_items")
        .select("transcript, metadata")
        .eq("id", contentItemId)
        .single();
      if (error || !data) {
        throw new Error(error?.message || "Content item not found");
      }
      return data;
    });

    const transcript = contentItem.transcript;
    if (!transcript || transcript.trim().length === 0) {
      return { message: "No transcript available to generate quiz" };
    }

    const { questions } = await step.run("generate-questions", async () => {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY not set");
      
      const openai = new OpenAI({ apiKey });
      const prompt = `
You are an expert corporate trainer.
Create a highly engaging 10-20 question quiz based on the following transcript.
The purpose is to use these questions for a spaced repetition "Daily Recall" exercise.
Create a mix of multiple_choice, true_false, and scenario-based questions.
Ensure options are clear. For true_false, provide exactly two options: ["True", "False"].
The correct_answer_index is a 0-based index into the options array.
Provide a clear, brief explainer_text that will be shown after the user answers.

Transcript:
${transcript.substring(0, 50000)} // Ensure we don't exceed token limits drastically
`;

      const completion = await openai.chat.completions.parse({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: zodResponseFormat(QuizSchema, "quiz"),
      });

      const result = completion.choices[0].message.parsed;
      if (!result) throw new Error("Failed to parse quiz response");
      
      return result;
    });

    await step.run("save-questions", async () => {
      const admin = createAdminClient();
      
      const rows = questions.map((q) => ({
        content_item_id: contentItemId,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        correct_answer_index: q.correct_answer_index,
        explainer_text: q.explainer_text,
      }));

      const { error } = await admin.from("quiz_questions").insert(rows);
      if (error) {
        throw new Error(`Failed to insert quiz questions: ${error.message}`);
      }
    });

    return { message: `Successfully created ${questions.length} quiz questions.` };
  }
);
