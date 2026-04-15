import type { AgentConfig } from "@opencode-ai/sdk/v2"
import { createBytesAgent } from "../../extensions/agents/bytes"
import { createExploreAgent } from "../../extensions/agents/explore"
import { createLibrarianAgent } from "../../extensions/agents/librarian"
import { createOracleAgent } from "../../extensions/agents/oracle"
import { log } from "../../shared"
import type { ConfigContext } from "./types"

/**
 * The default agent name to set when the user hasn't configured one.
 * "bytes" is the primary coding agent provided by this plugin.
 */
const DEFAULT_AGENT_NAME = "bytes"

/**
 * Creates the built-in agent configurations.
 *
 * Model parameter handling:
 * - Primary agent (bytes): model param selects prompt variant only;
 *   the returned config does NOT set `model` so it respects the user's UI selection.
 * - Subagents (explore, oracle, librarian): model param is passed through.
 *   When empty, OpenCode falls back to the default model.
 */
function createBuiltinAgents(): Record<string, AgentConfig> {
  // Empty model string: bytes defaults to Claude prompt variant,
  // subagents use OpenCode's default model resolution
  const defaultModelHint = ""

  return {
    bytes: createBytesAgent(defaultModelHint),
    explore: createExploreAgent(defaultModelHint),
    oracle: createOracleAgent(defaultModelHint),
    librarian: createLibrarianAgent(defaultModelHint),
  }
}

/**
 * Determines if an agent entry is explicitly disabled by the user.
 * An entry is considered disabled ONLY when `disable` is explicitly set to true.
 */
function isDisabledAgentEntry(value: AgentConfig): boolean {
  return typeof value === "object" && value !== null && "disable" in value && value.disable === true
}

/**
 * Captures the names of agents that are explicitly disabled by the user
 * in their configuration.
 */
function captureUserDisabledAgents(
  userAgents?: Record<string, AgentConfig | undefined>,
): Set<string> {
  const disabled = new Set<string>()
  if (!userAgents) return disabled

  for (const [key, value] of Object.entries(userAgents)) {
    if (value && isDisabledAgentEntry(value)) {
      disabled.add(key)
    }
  }
  return disabled
}

/**
 * Removes agents that are marked as disabled in the plugin configuration.
 * Returns the set of removed agent names for logging.
 */
function removeDisabledAgents(
  merged: Record<string, AgentConfig>,
  disabledAgents: string[],
): Set<string> {
  const disabledSet = new Set(disabledAgents)
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
 * Marks user-disabled agents as disabled in the merged configuration.
 * Preserves the rest of the agent configuration while ensuring disable is true.
 */
function applyUserDisabledAgents(
  merged: Record<string, AgentConfig>,
  userDisabledAgentNames: Set<string>,
): Set<string> {
  const applied = new Set<string>()

  for (const name of userDisabledAgentNames) {
    if (name in merged) {
      merged[name] = { ...merged[name], disable: true }
      applied.add(name)
    }
  }

  return applied
}

/**
 * Applies agent configuration by merging built-in agents with user-defined ones,
 * respecting both user-disabled and plugin-disabled settings.
 *
 * Priority order (highest to lowest):
 * 1. User-defined agents (from user config)
 * 2. Built-in agents (from plugin)
 *
 * Disable order:
 * 1. User-disabled agents (disable: true) - kept but disabled
 * 2. Plugin-disabled agents (disabled_agents array) - removed entirely
 *
 * Also sets `default_agent` to "bytes" if not already configured by the user.
 */
export function handleAgentConfig(ctx: ConfigContext): void {
  log("Applying agent configuration...")

  const { disabled_agents: pluginDisabledAgents = [] } = ctx.pluginConfig
  const userAgents = ctx.config.agent
  const userDisabledAgentNames = captureUserDisabledAgents(userAgents)

  // Merge built-in agents with user-defined agents, giving precedence to user-defined ones
  const builtinAgents = createBuiltinAgents()
  const merged: Record<string, AgentConfig> = {
    ...builtinAgents,
  }

  // Apply user overrides: user-defined agents take precedence
  if (userAgents) {
    for (const [key, value] of Object.entries(userAgents)) {
      if (value !== undefined) {
        merged[key] = value
      }
    }
  }

  // First: Apply user-disabled agents (preserve config but disable)
  const userDisabledApplied = applyUserDisabledAgents(merged, userDisabledAgentNames)
  for (const name of userDisabledApplied) {
    log(`  Disabled by user config: ${name}`)
  }

  // Second: Remove agents that are disabled via plugin configuration
  const pluginDisabledRemoved = removeDisabledAgents(merged, pluginDisabledAgents)
  for (const name of pluginDisabledRemoved) {
    log(`  Removed by plugin config: ${name}`)
  }

  // Log enabled agents for debugging
  const enabledCount = Object.values(merged).filter((a) => !a.disable).length
  log(`  Total agents enabled: ${enabledCount}`)

  ctx.config.agent = merged

  // Set default agent to "bytes" if not already configured and bytes is available
  if (
    !ctx.config.default_agent &&
    merged[DEFAULT_AGENT_NAME] &&
    !merged[DEFAULT_AGENT_NAME].disable
  ) {
    ctx.config.default_agent = DEFAULT_AGENT_NAME
    log(`  Default agent set to: ${DEFAULT_AGENT_NAME}`)
  }
}
