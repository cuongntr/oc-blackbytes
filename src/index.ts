import type { Plugin } from "@opencode-ai/plugin"
import { createOpenCodePlugin } from "./bootstrap"
import { loadPluginConfig } from "./config"

// import { discoverAvailableModels } from "./services"

const BlackbytesPlugin: Plugin = async (ctx) => {
  const { config: pluginConfig, warnings } = loadPluginConfig(ctx)
  for (const warning of warnings) {
    console.warn(warning)
  }

  // Discover connected providers for model fallback resolution (disabled by default)
  // Temporarily disabled until we have a better way to manage the overhead of model discovery on plugin startup
  const availableModels = new Map<string, Set<string>>()
    // pluginConfig.model_fallback === true
    //   ? await discoverAvailableModels(ctx.client)
    //   : new Map<string, Set<string>>()



  return createOpenCodePlugin({ input: ctx, pluginConfig, availableModels })
}

export default BlackbytesPlugin
