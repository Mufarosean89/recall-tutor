import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, requireGatewayKey } from "./ai-gateway.server";
import type { ChatTurn } from "./tutor.shared";

const MODEL = "google/gemini-3.7-flash";

function model() {
  return createLovableAiGatewayProvider(requireGatewayKey())(MODEL);
}

const TUTOR_SYSTEM = `You are a patient Socratic tutor for a student.
Explain clearly, with concrete examples and short paragraphs. Use markdown.
Keep answers focused (under ~200 words unless the student asks for depth).
Never do the student's recall for them: when the student asks "what did we cover",
prompt them to try recalling first.`;

export async function runTutor(messages: ChatTurn[]) {
  const result = await generateText({
    model: model(),
    system: TUTOR_SYSTEM,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  return {
    content: result.text,
    tokens: result.usage?.totalTokens ?? Math.ceil(result.text.length / 4),
  };
}

const checkpointSchema = z.object({
  concept: z.string().describe("The single concept being tested, 2-6 words"),
  question: z.string().describe("One short open-recall question, answerable in one or two sentences"),
  expected: z.string().describe("A model answer used only for grading, 1-3 sentences"),
});

export async function buildCheckpoint(messages: ChatTurn[]) {
  const transcript = messages
    .slice(-14)
    .map((m) => `${m.role === "user" ? "STUDENT" : "TUTOR"}: ${m.content}`)
    .join("\n\n");

  const { output } = await generateText({
    model: model(),
    output: Output.object({ schema: checkpointSchema }),
    system:
      "You write retrieval-practice checkpoints. Given a tutoring transcript, pick the single most important concept just covered and write one short recall question about it. The question must be answerable from the transcript, must not be a yes/no question, and must require the student to state the idea in their own words.",
    prompt: transcript,
  });

  return output;
}

const gradeSchema = z.object({
  correct: z.boolean().describe("True if the student demonstrated understanding, even with imperfect wording"),
  feedback: z.string().describe("One or two sentences of feedback to the student"),
  hint: z
    .string()
    .describe("If incorrect: a nudge that points toward the idea WITHOUT stating the answer. If correct: empty string."),
});

export async function gradeAttempt(input: {
  question: string;
  expected: string;
  answer: string;
  attempt: number;
}) {
  const { output } = await generateText({
    model: model(),
    output: Output.object({ schema: gradeSchema }),
    system: `You grade a student's recall attempt generously on substance, strictly on whether the core idea is present.
Wording, spelling and brevity do not matter. Vague restatements of the question do not count.
NEVER reveal the model answer in feedback or hint. On attempt 3 or later, make the hint substantially more concrete but still stop short of the answer.`,
    prompt: `QUESTION: ${input.question}\nMODEL ANSWER (secret): ${input.expected}\nATTEMPT #${input.attempt}\nSTUDENT ANSWER: ${input.answer}`,
  });

  return output;
}
