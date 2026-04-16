import type { Config } from "@opencode-ai/plugin"
import type { OcBlackbytesConfig } from "../../config"

export type ConfigContext = {
  config: Config
  pluginConfig: OcBlackbytesConfig
  /** Available models per connected provider for fallback resolution. Empty map if discovery was skipped. */
  availableModels: Map<string, Set<string>>
}
