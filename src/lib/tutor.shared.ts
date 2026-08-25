export type ChatRole = "user" | "assistant";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface Checkpoint {
  question: string;
  expected: string;
  concept: string;
}

export interface Grade {
  correct: boolean;
  feedback: string;
  hint: string;
}

/** Tokens of new material allowed before the recall gate closes the chat. */
export const CHECKPOINT_TOKENS = 700;
