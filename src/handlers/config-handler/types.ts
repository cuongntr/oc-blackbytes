import type { Config } from "@opencode-ai/plugin"
import type { OcBlackbytesConfig } from "../../config"

export type ConfigContext = {
  config: Config
  pluginConfig: OcBlackbytesConfig
}
