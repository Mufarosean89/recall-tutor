import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createOpenAICompatibleProvider(apiKey: string, baseURL: string) {
  return createOpenAICompatible({
    name: "openai-compatible",
    baseURL,
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

export function requireGatewayKey() {
  const key = process.env["OPENAI_API_KEY"];
  if (!key) throw new Error("Missing OPENAI_API_KEY");
  return key;
}
