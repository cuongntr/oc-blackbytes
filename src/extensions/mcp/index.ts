import type { McpRemoteConfig } from "@opencode-ai/sdk/v2"
import type { OcBlackbytesConfig } from "../../config"

import { context7 } from "./context7.js"
import { grep_app } from "./grep-app.js"
import { createWebsearchConfig } from "./websearch.js"

// Creates a record of built-in MCPs, excluding any that are specified in the disabledMcps array.
export function createBuiltinMcps(config?: OcBlackbytesConfig): Record<string, McpRemoteConfig> {
  const mcps: Record<string, McpRemoteConfig> = {}

  const websearchConfig = createWebsearchConfig(config?.websearch)
  if (websearchConfig) {
    mcps.websearch = websearchConfig
  }

  mcps.context7 = context7

  mcps.grep_app = grep_app

  return mcps
}
