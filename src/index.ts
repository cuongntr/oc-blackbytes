import type { Plugin } from "@opencode-ai/plugin"
import { createOpenCodePlugin } from "./bootstrap"
import { loadPluginConfig } from "./config"
import { discoverAvailableModels } from "./services"

const BlackbytesPlugin: Plugin = async (ctx) => {
  const pluginConfig = loadPluginConfig(ctx)

  // Discover connected providers for model fallback resolution
  const availableModels = pluginConfig.model_fallback
    ? await discoverAvailableModels(ctx.client)
    : new Map<string, Set<string>>()

  return createOpenCodePlugin({ input: ctx, pluginConfig, availableModels })
}

export default BlackbytesPlugin
