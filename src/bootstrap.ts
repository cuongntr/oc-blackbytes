import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import type { OcBlackbytesConfig } from "./config"
import { handleChatHeaders, handleConfig } from "./handlers"

/**
 * Creates the OpenCode plugin by setting up necessary hooks based on the provided configuration.
 * This function initializes the plugin's behavior by defining hooks that will be invoked during the plugin's lifecycle.
 *
 * @param params - An object containing the plugin input context and the plugin configuration.
 * @returns A promise that resolves to an object containing the hooks for the plugin.
 */
export async function createOpenCodePlugin({
  pluginConfig,
}: {
  input: PluginInput
  pluginConfig: OcBlackbytesConfig
}): Promise<Hooks> {
  return {
    ...handleConfig(pluginConfig),
    ...handleChatHeaders(pluginConfig),
    // Future: Add more handlers here as needed, such as command handlers, agent handlers, etc.
  }
}
