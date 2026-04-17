import type { Config } from "@opencode-ai/plugin"
import type { AgentConfig } from "@opencode-ai/sdk/v2"
import type { OcBlackbytesConfig } from "../../config"

export type ConfigContext = {
  config: Omit<Config, "agent"> & {
    default_agent?: string
    agent?: Record<string, AgentConfig | undefined>
  }
  pluginConfig: OcBlackbytesConfig
  /** Available models per connected provider for fallback resolution. Empty map if discovery was skipped. */
  availableModels: Map<string, Set<string>>
}
