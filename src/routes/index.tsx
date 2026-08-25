import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Brain, Loader2, Lock, LockOpen, Send, Sparkles } from "lucide-react";

import { createCheckpoint, gradeCheckpoint, tutorReply } from "@/lib/tutor.functions";
import { CHECKPOINT_TOKENS, type ChatTurn, type Checkpoint } from "@/lib/tutor.shared";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Proof-of-Understanding — AI tutor with recall checkpoints" },
      {
        name: "description",
        content:
          "An open-source AI tutor that pauses every few hundred tokens of new material and makes you recall it before the conversation continues.",
      },
      { property: "og:title", content: "Proof-of-Understanding — AI tutor with recall checkpoints" },
      {
        property: "og:description",
        content: "Chat with a tutor that won't let you skip retrieval practice.",
      },
    ],
  }),
  component: Tutor,
});

const SUGGESTIONS = [
  "Explain how photosynthesis actually stores energy",
  "Teach me the difference between mitosis and meiosis",
  "Why does a binary search take log n steps?",
];

const estimateTokens = (text: string) => Math.ceil(text.length / 4);

function Tutor() {
  const reply = useServerFn(tutorReply);
  const makeCheckpoint = useServerFn(createCheckpoint);
  const grade = useServerFn(gradeCheckpoint);

  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [covered, setCovered] = useState(0);
  const [cleared, setCleared] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null);
  const [buildingGate, setBuildingGate] = useState(false);
  const [answer, setAnswer] = useState("");
  const [attempt, setAttempt] = useState(1);
  const [grading, setGrading] = useState(false);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    feedback: string;
    hint?: string | undefined;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const locked = checkpoint !== null || buildingGate;
  const progress = Math.min(100, Math.round((covered / CHECKPOINT_TOKENS) * 100));

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking, checkpoint, feedback]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking || locked) return;
    setError(null);
    setInput("");
    const next: ChatTurn[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setThinking(true);

    try {
      const res = await reply({ data: { messages: next } });
      const withReply: ChatTurn[] = [...next, { role: "assistant", content: res.content }];
      setMessages(withReply);
      const spend = estimateTokens(trimmed) + estimateTokens(res.content);
      const total = covered + spend;
      setCovered(total);
      setThinking(false);

      if (total >= CHECKPOINT_TOKENS) {
        setBuildingGate(true);
        const gate = await makeCheckpoint({ data: { messages: withReply } });
        setCheckpoint(gate);
        setAttempt(1);
        setAnswer("");
        setFeedback(null);
        setBuildingGate(false);
      }
    } catch (e) {
      setThinking(false);
      setBuildingGate(false);
      setError(e instanceof Error ? e.message : "The tutor is unavailable right now.");
    }
  }

  async function submitAnswer() {
    if (!checkpoint || !answer.trim() || grading) return;
    setGrading(true);
    setError(null);
    try {
      const result = await grade({
        data: { question: checkpoint.question, expected: checkpoint.expected, answer: answer.trim(), attempt },
      });
      setFeedback(result);
      if (result.correct) {
        setCheckpoint(null);
        setCovered(0);
        setCleared((c) => c + 1);
      } else {
        setAttempt((a) => a + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Grading failed. Try again.");
    } finally {
      setGrading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground grid-paper">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4">
        <header className="flex items-center justify-between gap-4 border-b border-border py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Proof-of-Understanding</h1>
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                open tutor · retrieval gated
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              checkpoints cleared
            </p>
            <p className="font-display text-lg font-semibold text-primary">{cleared}</p>
          </div>
        </header>

        <div className="sticky top-0 z-10 -mx-4 bg-background/85 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {locked ? <Lock className="h-3 w-3 text-primary" /> : <LockOpen className="h-3 w-3" />}
              {locked ? "chat locked — recall required" : "new material since last checkpoint"}
            </span>
            <span>
              {Math.min(covered, CHECKPOINT_TOKENS)} / {CHECKPOINT_TOKENS} tok
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-500 ${locked ? "bg-primary" : "bg-accent"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto py-4">
          {messages.length === 0 && (
            <div className="rounded-lg border border-border bg-card/70 p-6">
              <h2 className="text-lg font-semibold">Learn something, then prove you kept it.</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Ask anything. After roughly {CHECKPOINT_TOKENS} tokens of new material, the chat pauses and asks you
                to recall a concept in your own words. Wrong answers get a hint and another attempt — never the
                answer.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground transition-colors hover:border-accent hover:text-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-lg rounded-br-sm bg-secondary px-4 py-2.5 text-sm text-secondary-foreground"
                    : "prose-tutor max-w-[92%] rounded-lg rounded-bl-sm border border-border bg-card px-4 py-3 text-sm leading-relaxed text-card-foreground"
                }
              >
                {m.role === "user" ? (
                  m.content
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                )}
              </div>
            </div>
          ))}

          {(thinking || buildingGate) && (
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {buildingGate ? "building checkpoint from what we just covered…" : "tutor is thinking…"}
            </div>
          )}

          {checkpoint && (
            <div className="gate-glow rounded-lg border border-primary/60 bg-card p-5">
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-primary">
                <Sparkles className="h-3.5 w-3.5" /> checkpoint · {checkpoint.concept}
              </p>
              <p className="mt-3 text-base font-medium leading-snug">{checkpoint.question}</p>

              {feedback && !feedback.correct && (
                <div className="mt-4 space-y-2 rounded-md border border-border bg-muted/60 p-3 text-sm">
                  <p className="text-muted-foreground">{feedback.feedback}</p>
                  {feedback.hint && (
                    <p>
                      <span className="font-mono text-[11px] uppercase tracking-widest text-accent">hint </span>
                      {feedback.hint}
                    </p>
                  )}
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    attempt {attempt}
                  </p>
                </div>
              )}

              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitAnswer();
                }}
                rows={3}
                placeholder="Answer from memory — scrolling up won't help you next time."
                className="mt-4 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={submitAnswer}
                disabled={grading || !answer.trim()}
                className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {grading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockOpen className="h-4 w-4" />}
                Unlock chat
              </button>
            </div>
          )}

          {feedback?.correct && !checkpoint && (
            <div className="rounded-lg border border-accent/50 bg-accent/10 p-4 text-sm">
              <p className="font-mono text-[11px] uppercase tracking-widest text-accent">checkpoint passed</p>
              <p className="mt-1.5 text-foreground">{feedback.feedback}</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive-foreground">
              {error}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 -mx-4 border-t border-border bg-background/90 px-4 py-3 backdrop-blur">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              disabled={locked}
              placeholder={locked ? "Chat is locked until you clear the checkpoint" : "Ask your tutor anything…"}
              className="max-h-40 flex-1 resize-none rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-accent disabled:opacity-50"
            />
            <button
              onClick={() => send(input)}
              disabled={locked || thinking || !input.trim()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            self-hostable · swap the gateway for ollama + open webui
          </p>
        </div>
      </div>
    </div>
  );
}
