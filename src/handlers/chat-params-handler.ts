import type { Hooks } from "@opencode-ai/plugin"
import type { OcBlackbytesConfig } from "../config"
import { log } from "../shared"
import { detectModelFamily, resolveModelSettings } from "../shared/model-capability"

/**
 * Creates the `chat.params` hook handler for runtime model parameter adaptation.
 *
 * This hook fires on every LLM call with the actual model/provider info,
 * solving the core problem: agent configs are created statically (often with
 * model=""), but the real model is only known at inference time.
 *
 * Responsibilities:
 * 1. Detect model family from actual runtime model (not config-time hint)
 * 2. Resolve compatible thinking/reasoning config via capability registry
 * 3. Apply graceful downgrading for unsupported settings (ladder-based)
 * 4. Track and log all parameter changes for debugging
 * 5. Apply user config overrides from plugin `agents` settings
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

      // Resolve compatible settings with graceful downgrading
      const resolved = resolveModelSettings({
        family,
        agentName,
        modelRef,
        supportsReasoning,
        userReasoningEffort: agentOverride?.reasoningEffort,
      })

      // Apply resolved thinking config
      if (resolved.thinking) {
        output.options.thinking = resolved.thinking
      } else {
        delete output.options.thinking
      }

      // Apply resolved reasoning effort
      if (resolved.reasoningEffort) {
        output.options.reasoningEffort = resolved.reasoningEffort
      } else {
        delete output.options.reasoningEffort
      }

      // Always strip textVerbosity (not used by any provider we support)
      delete output.options.textVerbosity

      // Apply user temperature override from plugin config
      if (agentOverride?.temperature !== undefined) {
        output.temperature = agentOverride.temperature
      }

      // Log with change tracking
      const changeLog =
        resolved.changes.length > 0
          ? ` changes=[${resolved.changes.map((c) => `${c.field}:${c.from}→${c.to ?? "removed"} (${c.reason})`).join(", ")}]`
          : ""
      log(
        `[chat.params] agent=${agentName} model=${modelRef} family=${family} reasoning=${supportsReasoning}${changeLog}`,
      )
    },
  }
}
