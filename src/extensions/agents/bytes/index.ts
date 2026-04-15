import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode } from "../types"
import { isGeminiModel, isGptModel } from "../utils"
import { BYTES_DESCRIPTION } from "./agent"
import { BYTES_DEFAULT_PROMPT } from "./default"
import { BYTES_GEMINI_PROMPT } from "./gemini"
import { BYTES_GPT_PROMPT } from "./gpt"

const MODE: AgentMode = "primary"

/**
 * Creates the Bytes primary agent configuration.
 *
 * Model-aware prompt selection:
 * - GPT models → prose-first prompt with reasoningEffort/textVerbosity
 * - Gemini models → numbered-section prompt with structured examples
 * - Default (Claude/others) → XML-tagged prompt with extended thinking
 *
 * As a primary agent, this does NOT set `model` on the config —
 * it respects the user's UI-selected model. The `model` parameter
 * is used solely for prompt variant selection.
 */
export function createBytesAgent(model: string): AgentConfig {
  const base = {
    description: BYTES_DESCRIPTION,
    mode: MODE,
    temperature: 0.3,
    color: "primary" as const,
  }

  if (isGptModel(model)) {
    return {
      ...base,
      prompt: BYTES_GPT_PROMPT,
      reasoningEffort: "medium",
      textVerbosity: "high",
    } as AgentConfig
  }

  if (isGeminiModel(model)) {
    return {
      ...base,
      prompt: BYTES_GEMINI_PROMPT,
    } as AgentConfig
  }

  // Default: Claude and other models — XML-tagged with extended thinking
  return {
    ...base,
    prompt: BYTES_DEFAULT_PROMPT,
    thinking: { type: "enabled", budgetTokens: 32000 },
  } as AgentConfig
}

createBytesAgent.mode = MODE

export { BYTES_DESCRIPTION, BYTES_PROMPT_METADATA } from "./agent"
