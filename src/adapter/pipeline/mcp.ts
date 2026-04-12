import type { Config, McpLocalConfig, McpRemoteConfig } from "@opencode-ai/sdk/v2"
import type { OcBlackbytesConfig } from "../../config"
import { createBuiltinMcps } from "../../extensions"

type McpEntry = McpLocalConfig | McpRemoteConfig | { enabled: boolean }

function isDisabledMcpEntry(value: McpEntry) {
  return typeof value === "object" && value !== null && !value.enabled
}

function captureUserDisabledMcps(userMcp?: Record<string, McpEntry>): Set<string> {
  const disabled = new Set<string>()
  if (!userMcp) return disabled

  for (const [key, value] of Object.entries(userMcp)) {
    if (isDisabledMcpEntry(value)) {
      disabled.add(key)
    }
  }
  return disabled
}

export async function applyMcpConfig(params: {
  config: Config
  pluginConfig: OcBlackbytesConfig
}): Promise<void> {
  const disabledMcps = params.pluginConfig.disabled_mcps ?? []
  const userMcp = params.config.mcp
  const userDisabledMcps = captureUserDisabledMcps(userMcp)

  const merged = {
    ...createBuiltinMcps(params.pluginConfig),
    ...(userMcp ?? {}),
  } as Record<string, McpEntry>

  for (const name of userDisabledMcps) {
    if (merged[name]) {
      merged[name] = { ...merged[name], enabled: false }
    }
  }

  const disabledSet = new Set(disabledMcps)
  for (const name of disabledSet) {
    delete merged[name]
  }

  params.config.mcp = merged
}
