import { context7 } from "./context7.js"
import { grep_app } from "./grep-app.js"
import type { RemoteMcpConfig } from "./types.ts"
import { createWebsearchConfig } from "./websearch.js"

export function createBuiltinkMcps(disabledMcps: string[] = [], config?: any) {
  const mcps: Record<string, RemoteMcpConfig> = {}

  if (!disabledMcps.includes("websearch")) {
    const websearchConfig = createWebsearchConfig(config?.websearch)
    if (websearchConfig) {
      mcps.websearch = websearchConfig
    }
  }

  if (!disabledMcps.includes("context7")) {
    mcps.context7 = context7
  }

  if (!disabledMcps.includes("grep_app")) {
    mcps.grep_app =  grep_app
  }

  return mcps
}
