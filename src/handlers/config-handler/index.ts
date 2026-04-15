import type { Hooks } from "@opencode-ai/plugin"
import type { OcBlackbytesConfig } from "../../config"
import { handleMcpConfig } from "./mcp-config-handler"
import type { ConfigContext } from "./types"

/**
 * Handles the plugin configuration by applying necessary transformations and merging
 */
export function handleConfig(pluginConfig: OcBlackbytesConfig): Hooks {
  return {
    config: async (config) => {
      // Create a context object that includes both the current configuration and the plugin configuration
      const configCtx: ConfigContext = { config, pluginConfig }

      // Apply MCP configuration, which merges built-in and user-defined MCPs while respecting disabled settings
      handleMcpConfig(configCtx)

      // handleCommandsConfig(configCtx) // Future: Handle command configuration similarly
      // handleAgentConfig(configCtx) // Future: Handle agent configuration similarly
    },
  }
}
