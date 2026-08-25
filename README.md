# Recall Tutor

Proof-of-Understanding is an open-source, self-hostable clone of ChatGPT-style AI tutoring, built to solve a specific problem: students can now get through an entire study session without ever having to recall anything themselves, because the model does the recalling for them. The project inserts a structural safeguard against that.

As a student converses with the tutor, the system tracks how much new material has been covered (measured by conversation tokens rather than clock time, so it scales with how much ground has actually been covered). Once a checkpoint threshold is crossed, the chat pauses and the student must correctly answer a short quiz — generated from the concepts just discussed — before the conversation can continue. Get it right, the chat unlocks and continues normally; get it wrong, the student gets a hint and another attempt rather than the answer outright.

Under the hood it's built entirely on open-source infrastructure: an open-source chat interface (Open WebUI) as the frontend, a locally-served open-weight LLM (via Ollama) as the tutor, and a custom middleware layer that owns the checkpoint logic, quiz generation, and grading. Nothing proprietary, nothing that requires an external API — which matters for schools with limited budgets or data-privacy constraints.

The result is a tutor that keeps the parts of LLM-assisted learning that work (patient, on-demand, personalized explanation) while removing the part that quietly undermines learning (never having to retrieve anything yourself).

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9a220dc6-1b6f-49c1-8754-5a8849b6581d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
