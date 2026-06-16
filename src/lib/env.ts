/**
 * Centralized environment access. Server-only secrets are read lazily so they
 * never get bundled into client components.
 */

export const publicEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "PIFinder",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  allowedEmailDomain: process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN ?? "snu.ac.kr",
};

/** Server-only env. Throws if a required secret is read on the client. */
export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must not be called in the browser");
  }
  return {
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    dbUrl: process.env.SUPABASE_DB_URL ?? "",
    bootstrapAdminEmails: (process.env.BOOTSTRAP_ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    llmProvider: process.env.LLM_PROVIDER ?? "mock",
    llmModel: process.env.LLM_MODEL ?? "claude-opus-4-8",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    openalexMailto: process.env.OPENALEX_MAILTO ?? "",
    semanticScholarApiKey: process.env.SEMANTIC_SCHOLAR_API_KEY ?? "",
    rateLimitRunsPerDay: Number(process.env.RATE_LIMIT_RUNS_PER_DAY ?? "20"),
    monthlyStoryGenerationLimit: Number(process.env.MONTHLY_STORY_GENERATION_LIMIT ?? "30"),
  };
}
