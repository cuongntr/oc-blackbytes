import type { Hooks } from "@opencode-ai/plugin"
import type { OcBlackbytesConfig } from "../config"
import { isClaudeModel, isGeminiModel, isGptModel } from "../extensions/agents/utils"
import { log } from "../shared"

/**
 * Default thinking config per agent for Claude models.
 * Only applied when the model supports reasoning (`capabilities.reasoning`).
 */
const CLAUDE_THINKING_DEFAULTS: Record<string, { type: string; budgetTokens: number }> = {
  bytes: { type: "enabled", budgetTokens: 32000 },
  oracle: { type: "enabled", budgetTokens: 32000 },
  general: { type: "enabled", budgetTokens: 16000 },
}

/**
 * Default reasoning effort per agent for OpenAI models.
 * Oracle gets "high" for stronger second-opinion reasoning;
 * bytes/general get "medium" for balanced cost/quality.
 */
const OPENAI_REASONING_DEFAULTS: Record<string, string> = {
  bytes: "medium",
  oracle: "high",
  general: "medium",
}

type ModelFamily = "claude" | "openai" | "gemini" | "other"

/**
 * Detects the model family using provider ID first (most reliable),
 * then falls back to model-name heuristics (for github-copilot and proxies).
 */
function detectModelFamily(providerID: string, modelRef: string): ModelFamily {
  if (providerID === "anthropic") return "claude"
  if (providerID === "openai") return "openai"
  if (providerID === "google" || providerID === "google-vertex") return "gemini"

  if (isClaudeModel(modelRef)) return "claude"
  if (isGptModel(modelRef)) return "openai"
  if (isGeminiModel(modelRef)) return "gemini"

  return "other"
}

/**
 * Applies Claude-specific options: thinking config for reasoning models,
 * and strips incompatible OpenAI options.
 */
function applyClaude(
  agentName: string,
  supportsReasoning: boolean,
  options: Record<string, unknown>,
): void {
  if (supportsReasoning) {
    const defaults = CLAUDE_THINKING_DEFAULTS[agentName]
    if (defaults) {
      options.thinking = { ...defaults }
    }
  }

  delete options.reasoningEffort
  delete options.textVerbosity
}

/**
 * Applies OpenAI-specific options: reasoning effort for reasoning models,
 * and strips incompatible Anthropic options.
 */
function applyOpenAI(
  agentName: string,
  supportsReasoning: boolean,
  userReasoningEffort: string | undefined,
  options: Record<string, unknown>,
): void {
  if (supportsReasoning) {
    const effort = userReasoningEffort ?? OPENAI_REASONING_DEFAULTS[agentName]
    if (effort) {
      options.reasoningEffort = effort
    }
  }

  delete options.thinking
}

/**
 * Strips all provider-specific options for models that don't use them
 * (Gemini, DeepSeek, Kimi, MiniMax, etc.).
 */
function stripProviderOptions(options: Record<string, unknown>): void {
  delete options.thinking
  delete options.reasoningEffort
  delete options.textVerbosity
}

/**
 * Creates the `chat.params` hook handler for runtime model parameter adaptation.
 *
 * This hook fires on every LLM call with the actual model/provider info,
 * solving the core problem: agent configs are created statically (often with
 * model=""), but the real model is only known at inference time.
 *
 * Responsibilities:
 * 1. Detect model family from actual runtime model (not config-time hint)
 * 2. Apply correct thinking/reasoning config per agent+model combination
 * 3. Strip incompatible provider-specific options (thinking on GPT, reasoningEffort on Claude)
 * 4. Apply user config overrides from plugin `agents` settings
 */
export function handleChatParams(pluginConfig: OcBlackbytesConfig): Hooks {
  return {
    "chat.params": async (input, output) => {
      const agentName = input.agent
      const model = input.model
      const providerID = model.providerID
      const modelID = model.id
      const modelRef = providerID ? `${providerID}/${modelID}` : modelID

      const family = detectModelFamily(providerID, modelRef)
      const agentOverride = pluginConfig.agents?.[agentName]
      const supportsReasoning = model.capabilities?.reasoning ?? false

      log(
        `[chat.params] agent=${agentName} model=${modelRef} family=${family} reasoning=${supportsReasoning}`,
      )

      switch (family) {
        case "claude": {
          applyClaude(agentName, supportsReasoning, output.options)
          break
        }
        case "openai": {
          applyOpenAI(agentName, supportsReasoning, agentOverride?.reasoningEffort, output.options)
          break
        }
        default: {
          stripProviderOptions(output.options)
          break
        }
      }

      // Apply user temperature override from plugin config
      if (agentOverride?.temperature !== undefined) {
        output.temperature = agentOverride.temperature
      }
    },
  }
}
