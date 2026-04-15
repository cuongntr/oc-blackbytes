import type { McpLocalConfig, McpRemoteConfig } from "@opencode-ai/sdk/v2"
import { createBuiltinMcps } from "../../extensions"
import { log } from "../../shared"
import type { ConfigContext } from "./types"

type McpEntry = McpLocalConfig | McpRemoteConfig

/**
 * Determines if an MCP entry is explicitly disabled by the user.
 * An entry is considered disabled ONLY when enabled is explicitly set to false.
 */
function isDisabledMcpEntry(value: McpEntry): boolean {
  return (
    typeof value === "object" && value !== null && "enabled" in value && value.enabled === false
  )
}

/**
 * Captures the names of MCPs that are explicitly disabled by the user
 * in their configuration.
 */
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

/**
 * Removes MCPs that are marked as disabled in the plugin configuration.
 * Returns the set of removed MCP names for logging.
 */
function removeDisabledMcps(merged: Record<string, McpEntry>, disabledMcps: string[]): Set<string> {
  const disabledSet = new Set(disabledMcps)
  const removed = new Set<string>()

  for (const name of disabledSet) {
    if (name in merged) {
      delete merged[name]
      removed.add(name)
    }
  }

  return removed
}

/**
 * Marks user-disabled MCPs as disabled in the merged configuration.
 * Preserves the rest of the MCP configuration while ensuring enabled is false.
 */
function applyUserDisabledMcps(
  merged: Record<string, McpEntry>,
  userDisabledMcpNames: Set<string>,
): Set<string> {
  const applied = new Set<string>()

  for (const name of userDisabledMcpNames) {
    if (name in merged) {
      // Preserve existing config but mark as disabled
      merged[name] = { ...merged[name], enabled: false }
      applied.add(name)
    }
  }

  return applied
}

/**
 * Applies MCP configuration by merging built-in MCPs with user-defined ones,
 * respecting both user-disabled and plugin-disabled settings.
 *
 * Priority order (highest to lowest):
 * 1. User-defined MCPs (from user config)
 * 2. Built-in MCPs (from plugin)
 *
 * Disable order:
 * 1. User-disabled MCPs (enabled: false) - kept but disabled
 * 2. Plugin-disabled MCPs (disabled_mcps array) - removed entirely
 */
export function handleMcpConfig(ctx: ConfigContext): void {
  log("Applying MCP configuration...")

  const { disabled_mcps: pluginDisabledMcps = [] } = ctx.pluginConfig
  const userMcp = ctx.config.mcp
  const userDisabledMcpNames = captureUserDisabledMcps(userMcp)

  // Merge built-in MCPs with user-defined MCPs, giving precedence to user-defined ones
  const merged: Record<string, McpEntry> = {
    ...createBuiltinMcps(ctx.pluginConfig),
    ...(userMcp ?? {}),
  }

  // First: Apply user-disabled MCPs (preserve config but disable)
  const userDisabledApplied = applyUserDisabledMcps(merged, userDisabledMcpNames)
  for (const name of userDisabledApplied) {
    log(`  Disabled by user config: ${name}`)
  }

  // Second: Remove MCPs that are disabled via plugin configuration
  const pluginDisabledRemoved = removeDisabledMcps(merged, pluginDisabledMcps)
  for (const name of pluginDisabledRemoved) {
    log(`  Removed by plugin config: ${name}`)
  }

  // Log enabled MCPs for debugging
  const enabledCount = Object.keys(merged).length
  log(`  Total MCPs enabled: ${enabledCount}`)

  ctx.config.mcp = merged
}
