import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, requireGatewayKey } from "./ai-gateway.server";
import type { ChatTurn } from "./tutor.shared";

const MODEL = "google/gemini-3.7-flash";

function model() {
  return createLovableAiGatewayProvider(requireGatewayKey())(MODEL);
}

function parseJson<T>(raw: string, schema: z.ZodType<T>): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("The model returned an unreadable response.");
  return schema.parse(JSON.parse(cleaned.slice(start, end + 1)));
}

const TUTOR_SYSTEM = `You are a patient Socratic tutor for a student.
Explain clearly, with concrete examples and short paragraphs. Use plain markdown.
Never use LaTeX or math delimiters like $...$ — write math in plain text (e.g. log2(n), O(n)).
Keep answers focused (under ~200 words unless the student asks for depth).
Never do the student's recall for them: if the student asks what you covered, ask them to try recalling first.`;

export async function runTutor(messages: ChatTurn[]) {
  const result = await generateText({
    model: model(),
    system: TUTOR_SYSTEM,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  return { content: result.text };
}

const checkpointSchema = z.object({
  concept: z.string(),
  question: z.string(),
  expected: z.string(),
});

export async function buildCheckpoint(messages: ChatTurn[]) {
  const transcript = messages
    .slice(-14)
    .map((m) => `${m.role === "user" ? "STUDENT" : "TUTOR"}: ${m.content}`)
    .join("\n\n");

  const { text } = await generateText({
    model: model(),
    system: `You write retrieval-practice checkpoints. Given a tutoring transcript, pick the single most important concept just covered and write ONE short recall question about it.
The question must be answerable from the transcript, must not be yes/no, and must require the student to state the idea in their own words.
Respond with JSON only, no prose, no code fences, in exactly this shape:
{"concept": "2-6 words", "question": "the question", "expected": "1-3 sentence model answer used only for grading"}`,
    prompt: transcript,
  });

  return parseJson(text, checkpointSchema);
}

const gradeSchema = z.object({
  correct: z.boolean(),
  feedback: z.string(),
  hint: z.string().default(""),
});

export async function gradeAttempt(input: {
  question: string;
  expected: string;
  answer: string;
  attempt: number;
}) {
  const { text } = await generateText({
    model: model(),
    system: `You grade a student's recall attempt generously on wording, strictly on substance: the core idea must be present. Spelling and brevity do not matter; vague restatements of the question do not count.
NEVER reveal the model answer in feedback or hint. On attempt 3 or later, make the hint noticeably more concrete but still stop short of the answer.
Respond with JSON only, no prose, no code fences, in exactly this shape:
{"correct": true|false, "feedback": "one or two sentences addressed to the student", "hint": "a nudge toward the idea if incorrect, otherwise an empty string"}`,
    prompt: `QUESTION: ${input.question}\nMODEL ANSWER (secret): ${input.expected}\nATTEMPT #${input.attempt}\nSTUDENT ANSWER: ${input.answer}`,
  });

  return parseJson(text, gradeSchema);
}
