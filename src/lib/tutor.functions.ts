import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildCheckpoint, gradeAttempt, runTutor } from "./tutor.server";

const turnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const tutorReply = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ messages: z.array(turnSchema).min(1) }).parse(input))
  .handler(async ({ data }) => runTutor(data.messages));

export const createCheckpoint = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ messages: z.array(turnSchema).min(1) }).parse(input))
  .handler(async ({ data }) => buildCheckpoint(data.messages));

export const gradeCheckpoint = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        question: z.string(),
        expected: z.string(),
        answer: z.string().min(1),
        attempt: z.number().int().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }) => gradeAttempt(data));
