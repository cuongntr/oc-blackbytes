import z from "zod"
import { AnyMcpNameSchema } from "./mcp"
import { WebsearchConfigSchema } from "./websearch"

/**
 * Per-fallback-model tuning — allows per-model overrides when used in a fallback chain.
 * Each entry specifies a model ID and optional parameter overrides.
 */
export const FallbackModelObjectSchema = z.object({
  model: z.string(),
  reasoningEffort: z.string().optional(),
  temperature: z.number().optional(),
})

/**
 * Flexible fallback models format — supports:
 * - Single string: `"openai/gpt-5.4"`
 * - Array of strings: `["openai/gpt-5.4", "google/gemini-3-flash"]`
 * - Array of objects: `[{ model: "openai/gpt-5.4", reasoningEffort: "high" }]`
 * - Mixed array: `["openai/gpt-5.4", { model: "google/gemini-3-flash", temperature: 0.1 }]`
 */
export const FallbackModelsSchema = z.union([
  z.string(),
  z.array(z.union([z.string(), FallbackModelObjectSchema])),
])

/**
 * Per-agent model configuration for overriding built-in agent defaults.
 * - `model`: Override the agent's default model (e.g., `"openai/gpt-5.4"` for oracle)
 * - `reasoningEffort`: Override reasoning effort level (for OpenAI reasoning models)
 * - `temperature`: Override temperature (e.g., lower for search agents, higher for creative)
 * - `fallback_models`: Per-agent fallback chain — tried when the primary model's provider is unavailable
 */
export const AgentModelConfigSchema = z.object({
  model: z.string().optional(),
  reasoningEffort: z.string().optional(),
  temperature: z.number().optional(),
  fallback_models: FallbackModelsSchema.optional(),
})

export type AgentModelConfig = z.infer<typeof AgentModelConfigSchema>
export type FallbackModelObject = z.infer<typeof FallbackModelObjectSchema>

export const OcBlackbytesConfigSchema = z.object({
  $schema: z.string().optional(),

  disabled_mcps: z.array(AnyMcpNameSchema).optional(),
  disabled_agents: z.array(z.string()).optional(),
  disabled_hooks: z.array(z.string()).optional(),
  /** Disable specific tools by name (e.g., ["totowrite", "todoread"]) */
  disabled_tools: z.array(z.string()).optional(),

  mcp_env_alllowlist: z.array(z.string()).optional(),
  hashline_edit: z.boolean().optional(),
  /** Enable model fallback resolution: discover connected providers at init and resolve fallback chains (default: false) */
  model_fallback: z.boolean().optional(),
  auto_update: z.boolean().optional(),
  websearch: WebsearchConfigSchema.optional(),

  /**
   * Per-agent model configuration overrides.
   * Allows setting specific models, reasoning effort, and temperature per agent.
   *
   * @example
   * ```jsonc
   * {
   *   "agents": {
   *     "oracle": { "model": "openai/gpt-5.4", "reasoningEffort": "high" },
   *     "explore": { "model": "google/gemini-3-flash" },
   *     "librarian": { "model": "minimax/minimax-m2.7" },
   *     "general": { "model": "anthropic/claude-sonnet-4-6" }
   *   }
   * }
   * ```
   */
  agents: z.record(z.string(), AgentModelConfigSchema).optional(),

  /**
   * Global fallback model chain for all agents.
   * When an agent's preferred model is unavailable (provider not connected),
   * the plugin walks this chain and uses the first model whose provider is connected.
   * Disabled by default. Set `model_fallback: true` to enable.
   */
  fallback_models: FallbackModelsSchema.optional(),

  _migrations: z.array(z.string()).optional(),
})

export type OcBlackbytesConfig = z.infer<typeof OcBlackbytesConfigSchema>
