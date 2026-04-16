/**
 * Built-in fallback chains for each agent.
 *
 * Each chain entry lists a model prefix and the providers to try (in order).
 * The resolver expands these against the actual model list from `provider.list()`
 * using prefix matching (e.g., "claude-sonnet-4-6" matches "claude-sonnet-4-6-20260401").
 *
 * Design rationale:
 * - oracle: Cross-provider diversity is the primary goal — OpenAI first to differ from
 *   the typical Claude primary. Reasoning-capable models prioritized.
 * - explore: Cheapest/fastest models. Low temperature for deterministic search.
 * - librarian: Cheap but slightly more capable for research synthesis.
 * - general: Mid-tier coding models. Bytes scopes tasks for it, so no flagship needed.
 * - bytes: No chain — respects the user's UI model selection.
 */

export type FallbackChainEntry = {
  /** Model ID prefix to match against available models */
  model: string
  /** Providers to try in order */
  providers: string[]
  reasoningEffort?: string
  temperature?: number
}

export const BUILTIN_FALLBACK_CHAINS: Record<string, FallbackChainEntry[]> = {
  oracle: [
    { model: "gpt-5.4", providers: ["openai", "github-copilot"], reasoningEffort: "high" },
    { model: "gemini-3.1-pro", providers: ["google"] },
    { model: "claude-opus-4-6", providers: ["anthropic", "github-copilot"] },
  ],

  explore: [
    { model: "gemini-3-flash", providers: ["google"], temperature: 0.1 },
    { model: "claude-haiku-4-5", providers: ["anthropic", "github-copilot"], temperature: 0.1 },
    { model: "gpt-5-nano", providers: ["openai", "github-copilot"], temperature: 0.1 },
    { model: "minimax-m2.7", providers: ["minimax"], temperature: 0.1 },
  ],

  librarian: [
    { model: "claude-haiku-4-5", providers: ["anthropic", "github-copilot"], temperature: 0.2 },
    { model: "gemini-3-flash", providers: ["google"], temperature: 0.2 },
    { model: "gpt-5-nano", providers: ["openai", "github-copilot"], temperature: 0.2 },
  ],

  general: [
    { model: "claude-sonnet-4-6", providers: ["anthropic", "github-copilot"] },
    { model: "kimi-k2.5", providers: ["kimi"] },
    { model: "gpt-5.4-mini", providers: ["openai", "github-copilot"] },
    { model: "gemini-3.1-pro", providers: ["google"] },
  ],
}
