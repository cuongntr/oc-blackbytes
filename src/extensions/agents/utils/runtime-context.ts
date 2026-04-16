import type { AgentConfig } from "@opencode-ai/sdk/v2"

/**
 * Runtime resource information available to agents.
 * Computed after all config merging and disabling is complete.
 */
export type AgentRuntimeContext = {
  /** Names of enabled bundled tools (e.g., "hashline_edit", "grep") */
  enabledTools: string[]
  /** Names of enabled MCP servers (e.g., "websearch", "context7") */
  enabledMcps: string[]
  /** Names of enabled agents mapped to their descriptions */
  enabledAgents: Record<string, string>
}

/** Brief descriptions for well-known built-in MCP servers */
const BUILTIN_MCP_DESCRIPTIONS: Record<string, string> = {
  websearch: "web search and page fetching",
  context7: "library/framework documentation lookup",
  grep_app: "GitHub code search across public repositories",
}

/**
 * Builds a runtime context section to append to an agent's prompt.
 * Lists available resources so the agent knows what it can and cannot use.
 *
 * @param context - The runtime context with enabled resources
 * @param agentName - Name of the agent receiving this section (excluded from agent list)
 */
export function buildRuntimeContextSection(
  context: AgentRuntimeContext,
  agentName: string,
): string {
  const lines: string[] = []

  // Bundled tools
  if (context.enabledTools.length > 0) {
    lines.push(`Bundled tools: ${context.enabledTools.join(", ")}`)
  }

  // MCP servers with descriptions
  if (context.enabledMcps.length > 0) {
    const mcpEntries = context.enabledMcps.map((name) => {
      const desc = BUILTIN_MCP_DESCRIPTIONS[name]
      return desc ? `${name} (${desc})` : name
    })
    lines.push(`MCP servers: ${mcpEntries.join(", ")}`)
    lines.push("MCP tools are namespaced as {server}_{tool} (e.g., websearch_web_search_exa).")
  }

  // Peer agents (exclude self)
  const peerAgents = Object.entries(context.enabledAgents).filter(([name]) => name !== agentName)
  if (peerAgents.length > 0) {
    const agentEntries = peerAgents.map(([name, desc]) => `- ${name}: ${desc}`)
    lines.push(`\nAvailable agents:\n${agentEntries.join("\n")}`)
  }

  if (lines.length === 0) return ""

  return `\n<available_resources>
The following resources are enabled in this session. Only reference tools, MCP servers, and agents listed here — others may be disabled or unavailable.

${lines.join("\n")}
</available_resources>`
}

/**
 * Computes the runtime context from the final merged configuration state.
 */
export function computeRuntimeContext(
  enabledAgents: Record<string, AgentConfig>,
  enabledMcpNames: string[],
  enabledToolNames: string[],
): AgentRuntimeContext {
  const agentDescriptions: Record<string, string> = {}
  for (const [name, agent] of Object.entries(enabledAgents)) {
    if (agent.disable) continue
    agentDescriptions[name] = agent.description ?? name
  }

  return {
    enabledTools: enabledToolNames,
    enabledMcps: enabledMcpNames,
    enabledAgents: agentDescriptions,
  }
}

/**
 * Appends runtime context sections to all enabled agents' prompts.
 */
export function appendRuntimeContextToAgents(
  agents: Record<string, AgentConfig>,
  context: AgentRuntimeContext,
): void {
  for (const [name, agent] of Object.entries(agents)) {
    if (agent.disable || !agent.prompt) continue

    const section = buildRuntimeContextSection(context, name)
    if (section) {
      agent.prompt += section
    }
  }
}
