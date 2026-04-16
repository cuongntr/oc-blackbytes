import type { AgentConfig } from "@opencode-ai/sdk/v2"
import type { AgentMode } from "../types"
import { isGeminiModel, isGptModel } from "../utils"
import { createAgentToolRestrictions } from "../utils/permission-compat"
import { BYTES_DESCRIPTION } from "./agent"
import { buildBytesDefaultPrompt } from "./default"
import { buildBytesGeminiPrompt } from "./gemini"
import { buildBytesGptPrompt } from "./gpt"

const MODE: AgentMode = "primary"

/**
 * Tools denied for the primary agent.
 * todowrite/todoread add noise and consume tokens without meaningful benefit —
 * the agent organizes work through structured thinking instead.
 */
const DENIED_TOOLS = ["todowrite", "todoread"]

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
export function createBytesAgent(model: string, hashlineEditEnabled = true): AgentConfig {
  const restrictions = createAgentToolRestrictions(DENIED_TOOLS)
  const permission = { ...restrictions.permission, question: "allow" as const }

  const base = {
    description: BYTES_DESCRIPTION,
    mode: MODE,
    temperature: 0.3,
    color: "primary" as const,
    permission,
  }

  if (isGptModel(model)) {
    return {
      ...base,
      prompt: buildBytesGptPrompt(hashlineEditEnabled),
      reasoningEffort: "medium",
      textVerbosity: "high",
    } as AgentConfig
  }

  if (isGeminiModel(model)) {
    return {
      ...base,
      prompt: buildBytesGeminiPrompt(hashlineEditEnabled),
    } as AgentConfig
  }

  // Default: Claude and other models — XML-tagged with extended thinking
  return {
    ...base,
    prompt: buildBytesDefaultPrompt(hashlineEditEnabled),
    thinking: { type: "enabled", budgetTokens: 32000 },
  } as AgentConfig
}

createBytesAgent.mode = MODE

export { BYTES_DESCRIPTION, BYTES_PROMPT_METADATA } from "./agent"
