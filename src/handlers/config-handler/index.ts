import type { Hooks } from "@opencode-ai/plugin"
import type { OcBlackbytesConfig } from "../../config"
import { handleAgentConfig } from "./agent-config-handler"
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

      // Apply MCP configuration, which merges built-in and user-defined MCPs while respecting disabled settings
      handleMcpConfig(configCtx)

      // Apply agent configuration, which merges built-in agents (bytes, explore, oracle, librarian)
      // with user-defined agents while respecting disabled settings
      handleAgentConfig(configCtx)

      // handleCommandsConfig(configCtx) // Future: Handle command configuration similarly
    },
  }
}
