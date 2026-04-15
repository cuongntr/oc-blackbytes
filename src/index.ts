import type { Plugin } from "@opencode-ai/plugin"
import { createOpenCodePlugin } from "./bootstrap"
import { loadPluginConfig } from "./config"

const BlackbytesPlugin: Plugin = async (ctx) => {
  const pluginConfig = loadPluginConfig(ctx)

  return createOpenCodePlugin({ input: ctx, pluginConfig })
}

export default BlackbytesPlugin
