import type { Plugin } from "@opencode-ai/plugin"
import { applyMcpConfig } from "./adapter/pipeline/mcp"
import { loadPluginConfig } from "./config"

export const BlackbytesPlugin: Plugin = async (input) => {
  const pluginConfig = loadPluginConfig(input)

  return {
    config: async (config) => {
      await applyMcpConfig({
        pluginConfig,
        config,
      })
    },
  }
}

export default BlackbytesPlugin
