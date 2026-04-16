import type { Hooks } from "@opencode-ai/plugin"
import type { OcBlackbytesConfig } from "../../config"
import { log } from "../../shared"
import { handleAgentConfig } from "./agent-config-handler"
import { handleCommandConfig } from "./command-config-handler"
import { handleMcpConfig } from "./mcp-config-handler"
import type { ConfigContext } from "./types"

/**
 * Handles the plugin configuration by applying necessary transformations and merging
 */
export function handleConfig(
  pluginConfig: OcBlackbytesConfig,
  availableModels: Map<string, Set<string>>,
): Hooks {
  return {
    config: async (config) => {
      // Create a context object that includes both the current configuration and the plugin configuration
      const configCtx: ConfigContext = { config, pluginConfig, availableModels }
      log(`[config] Available models: ${availableModels.size} provider(s) discovered`)

      // Apply MCP configuration, which merges built-in and user-defined MCPs while respecting disabled settings
      handleMcpConfig(configCtx)

      // Apply agent configuration, which merges built-in agents (bytes, explore, oracle, librarian)
      // with user-defined agents while respecting disabled settings
      handleAgentConfig(configCtx)

      // Apply command configuration, registering built-in commands
      handleCommandConfig(configCtx)
    },
  }
}
