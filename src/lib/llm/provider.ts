import "server-only";
import { serverEnv } from "@/lib/env";

/**
 * Swappable LLM provider abstraction. The rest of the app depends only on the
 * `LlmProvider` interface, so providers can be changed via env without code
 * changes. Default is "mock" so the app runs with no API keys.
 *
 * SECURITY: provider API keys are read from server-only env here and never
 * reach the browser. All callers run server-side (server actions / route
 * handlers).
 */
export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface LlmResult {
  text: string;
  usage: LlmUsage;
}

export interface LlmProvider {
  readonly id: string;
  readonly model: string;
  complete(messages: LlmMessage[], opts?: { maxTokens?: number }): Promise<LlmResult>;
}

/** Rough token estimate when the provider doesn't report usage (~4 chars/token). */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil((text ?? "").length / 4));
}

class MockProvider implements LlmProvider {
  readonly id = "mock";
  readonly model = "mock";
  async complete(messages: LlmMessage[]): Promise<LlmResult> {
    const last = messages[messages.length - 1]?.content ?? "";
    const text = `# [MOCK LLM OUTPUT]\n\nThis is a deterministic placeholder. Set LLM_PROVIDER=anthropic and ANTHROPIC_API_KEY to enable a real model.\n\nPrompt echo (truncated): ${last.slice(0, 240)}`;
    const inputTokens = messages.reduce((n, m) => n + estimateTokens(m.content), 0);
    const outputTokens = estimateTokens(text);
    return { text, usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens } };
  }
}

class AnthropicProvider implements LlmProvider {
  readonly id = "anthropic";
  constructor(
    private apiKey: string,
    readonly model: string,
  ) {}

  async complete(messages: LlmMessage[], opts?: { maxTokens?: number }): Promise<LlmResult> {
    const system = messages.find((m) => m.role === "system")?.content;
    const rest = messages.filter((m) => m.role !== "system");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: opts?.maxTokens ?? 1024,
        system,
        messages: rest.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
    }
    const json = await res.json();
    const text = json.content?.[0]?.text ?? "";
    const inputTokens = json.usage?.input_tokens ?? messages.reduce((n, m) => n + estimateTokens(m.content), 0);
    const outputTokens = json.usage?.output_tokens ?? estimateTokens(text);
    return { text, usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens } };
  }
}

let cached: LlmProvider | null = null;

/** Returns the configured provider. Throws only if a real provider is selected but misconfigured. */
export function getLlm(): LlmProvider {
  if (cached) return cached;
  const { llmProvider, llmModel, anthropicApiKey } = serverEnv();
  if (llmProvider === "anthropic" && anthropicApiKey) {
    cached = new AnthropicProvider(anthropicApiKey, llmModel);
  } else {
    cached = new MockProvider();
  }
  return cached;
}

/** True when a real (non-mock) provider is configured. */
export function isLlmConfigured(): boolean {
  const { llmProvider, anthropicApiKey } = serverEnv();
  return llmProvider === "anthropic" && Boolean(anthropicApiKey);
}
