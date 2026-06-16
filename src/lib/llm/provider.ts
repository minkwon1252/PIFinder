import "server-only";
import { serverEnv } from "@/lib/env";

/**
 * Swappable, multi-provider LLM abstraction. Callers depend only on the
 * `LlmProvider` interface; the concrete provider is chosen per request from the
 * ones that are actually configured (have a key). Default is "mock" so the app
 * runs with no keys.
 *
 * SECURITY: provider API keys are read from server-only env here and never reach
 * the browser. The client only sends a provider id (e.g. "openai"); the backend
 * supplies the matching key.
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

export type ProviderId = "anthropic" | "openai" | "gemini" | "mock";

/** Rough token estimate when a provider doesn't report usage (~4 chars/token). */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil((text ?? "").length / 4));
}

function estimateUsage(messages: LlmMessage[], text: string): LlmUsage {
  const inputTokens = messages.reduce((n, m) => n + estimateTokens(m.content), 0);
  const outputTokens = estimateTokens(text);
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
}

class MockProvider implements LlmProvider {
  readonly id = "mock";
  readonly model = "mock";
  async complete(messages: LlmMessage[]): Promise<LlmResult> {
    const last = messages[messages.length - 1]?.content ?? "";
    const text = `# [MOCK LLM OUTPUT]\n\nThis is a deterministic placeholder. Configure a provider (anthropic / openai / gemini) and its API key to enable a real model.\n\nPrompt echo (truncated): ${last.slice(0, 240)}`;
    return { text, usage: estimateUsage(messages, text) };
  }
}

class AnthropicProvider implements LlmProvider {
  readonly id = "anthropic";
  constructor(private apiKey: string, readonly model: string) {}
  async complete(messages: LlmMessage[], opts?: { maxTokens?: number }): Promise<LlmResult> {
    const system = messages.find((m) => m.role === "system")?.content;
    const rest = messages.filter((m) => m.role !== "system");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        max_tokens: opts?.maxTokens ?? 1024,
        system,
        messages: rest.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const text = json.content?.[0]?.text ?? "";
    const u = json.usage;
    const inputTokens = u?.input_tokens ?? estimateUsage(messages, text).inputTokens;
    const outputTokens = u?.output_tokens ?? estimateTokens(text);
    return { text, usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens } };
  }
}

class OpenAIProvider implements LlmProvider {
  readonly id = "openai";
  constructor(private apiKey: string, readonly model: string) {}
  async complete(messages: LlmMessage[], opts?: { maxTokens?: number }): Promise<LlmResult> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        max_tokens: opts?.maxTokens ?? 1024,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content ?? "";
    const u = json.usage;
    const inputTokens = u?.prompt_tokens ?? estimateUsage(messages, text).inputTokens;
    const outputTokens = u?.completion_tokens ?? estimateTokens(text);
    return {
      text,
      usage: { inputTokens, outputTokens, totalTokens: u?.total_tokens ?? inputTokens + outputTokens },
    };
  }
}

class GeminiProvider implements LlmProvider {
  readonly id = "gemini";
  constructor(private apiKey: string, readonly model: string) {}
  async complete(messages: LlmMessage[], opts?: { maxTokens?: number }): Promise<LlmResult> {
    const system = messages.find((m) => m.role === "system")?.content;
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": this.apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          ...(system ? { system_instruction: { parts: [{ text: system }] } } : {}),
          contents,
          generationConfig: { maxOutputTokens: opts?.maxTokens ?? 1024 },
        }),
      },
    );
    if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const text = (json.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
    const u = json.usageMetadata;
    const inputTokens = u?.promptTokenCount ?? estimateUsage(messages, text).inputTokens;
    const outputTokens = u?.candidatesTokenCount ?? estimateTokens(text);
    return {
      text,
      usage: { inputTokens, outputTokens, totalTokens: u?.totalTokenCount ?? inputTokens + outputTokens },
    };
  }
}

const cache = new Map<string, LlmProvider>();

/**
 * Returns a provider instance. `requested` (from the user's choice) wins when it
 * is configured; otherwise falls back to the default LLM_PROVIDER, then mock.
 */
export function getLlm(requested?: string | null): LlmProvider {
  const env = serverEnv();
  const choice = (requested && requested.trim()) || env.llmProvider;

  const build = (id: string): LlmProvider | null => {
    switch (id) {
      case "anthropic":
        return env.anthropicApiKey ? new AnthropicProvider(env.anthropicApiKey, env.llmModel) : null;
      case "openai":
        return env.openaiApiKey ? new OpenAIProvider(env.openaiApiKey, env.openaiModel) : null;
      case "gemini":
        return env.geminiApiKey ? new GeminiProvider(env.geminiApiKey, env.geminiModel) : null;
      default:
        return null;
    }
  };

  const id = build(choice) ? choice : build(env.llmProvider) ? env.llmProvider : "mock";
  if (!cache.has(id)) cache.set(id, build(id) ?? new MockProvider());
  return cache.get(id)!;
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Claude (Anthropic)",
  openai: "ChatGPT (OpenAI)",
  gemini: "Gemini (Google)",
};

/** Configured providers (those with a key) for the user-facing picker. No keys leak. */
export function availableProviders(): { id: ProviderId; label: string }[] {
  const env = serverEnv();
  const out: { id: ProviderId; label: string }[] = [];
  if (env.anthropicApiKey) out.push({ id: "anthropic", label: PROVIDER_LABELS.anthropic! });
  if (env.openaiApiKey) out.push({ id: "openai", label: PROVIDER_LABELS.openai! });
  if (env.geminiApiKey) out.push({ id: "gemini", label: PROVIDER_LABELS.gemini! });
  return out;
}

/** True when at least one real provider is configured. */
export function isLlmConfigured(): boolean {
  return availableProviders().length > 0;
}
