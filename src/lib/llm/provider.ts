import "server-only";
import { serverEnv } from "@/lib/env";

/**
 * Swappable LLM provider abstraction. The rest of the app depends only on the
 * `LlmProvider` interface, so providers can be changed via env without code
 * changes. Default is "mock" so the app runs with no API keys.
 *
 * To add the latest Claude models in production, set LLM_PROVIDER=anthropic and
 * LLM_MODEL=claude-opus-4-8 (see .env.example) and implement the call below.
 */
export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmProvider {
  readonly id: string;
  complete(messages: LlmMessage[], opts?: { maxTokens?: number }): Promise<string>;
}

class MockProvider implements LlmProvider {
  readonly id = "mock";
  async complete(messages: LlmMessage[]): Promise<string> {
    const last = messages[messages.length - 1]?.content ?? "";
    return `# [MOCK LLM OUTPUT]\n\nThis is a deterministic placeholder. Configure LLM_PROVIDER to enable a real model.\n\nPrompt echo (truncated): ${last.slice(0, 240)}`;
  }
}

class AnthropicProvider implements LlmProvider {
  readonly id = "anthropic";
  constructor(
    private apiKey: string,
    private model: string,
  ) {}

  async complete(messages: LlmMessage[], opts?: { maxTokens?: number }): Promise<string> {
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
    return json.content?.[0]?.text ?? "";
  }
}

let cached: LlmProvider | null = null;

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
