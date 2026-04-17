/**
 * Extended tests for runtime-context utilities.
 * The existing test/agent-config.test.ts covers the happy-path of appendRuntimeContextToAgents.
 * This file covers edge cases: disabled MCPs, disabled agents, disabled tools, all-disabled.
 */
import { describe, expect, it } from "bun:test"
import type { AgentConfig } from "@opencode-ai/sdk/v2"
import {
  type AgentRuntimeContext,
  appendRuntimeContextToAgents,
  buildRuntimeContextSection,
  computeRuntimeContext,
} from "../../src/extensions/agents/utils/runtime-context"

describe("buildRuntimeContextSection", () => {
  it("disabled MCPs excluded from available_resources section", () => {
    const context: AgentRuntimeContext = {
      enabledTools: ["grep"],
      enabledMcps: ["context7"], // websearch is 'disabled' — not in list
      enabledAgents: {},
    }
    const section = buildRuntimeContextSection(context, "bytes")
    expect(section).toContain("context7")
    // websearch should not appear as a listed MCP server (the example line is implementation detail)
    expect(section).toContain("MCP servers: context7")
    expect(section).not.toContain("MCP servers: context7, websearch")
    expect(section).not.toContain("websearch (web search")
  })

  it("agent-peer list respects disabled_agents — disabled agents not present", () => {
    const context: AgentRuntimeContext = {
      enabledTools: [],
      enabledMcps: [],
      enabledAgents: {
        bytes: "Primary coding agent",
        // explore is disabled — not in enabledAgents
      },
    }
    // Section for the 'explore' agent (which sees bytes as a peer, not itself)
    const section = buildRuntimeContextSection(context, "explore")
    expect(section).toContain("bytes")
    expect(section).not.toContain("explore")
  })

  it("tool list respects disabled_tools — disabled tools not present", () => {
    const context: AgentRuntimeContext = {
      enabledTools: ["grep", "glob"], // hashline_edit disabled
      enabledMcps: [],
      enabledAgents: {},
    }
    const section = buildRuntimeContextSection(context, "bytes")
    expect(section).toContain("grep")
    expect(section).toContain("glob")
    expect(section).not.toContain("hashline_edit")
  })

  it("returns empty string when all resources are empty", () => {
    const context: AgentRuntimeContext = {
      enabledTools: [],
      enabledMcps: [],
      enabledAgents: {},
    }
    const section = buildRuntimeContextSection(context, "bytes")
    expect(section).toBe("")
  })

  it("excludes the receiving agent from peer list", () => {
    const context: AgentRuntimeContext = {
      enabledTools: [],
      enabledMcps: [],
      enabledAgents: {
        bytes: "Primary coding agent",
        oracle: "Reasoning specialist",
      },
    }
    const section = buildRuntimeContextSection(context, "bytes")
    expect(section).toContain("oracle")
    expect(section).not.toMatch(/- bytes:/)
  })

  it("MCP descriptions are appended for known servers", () => {
    const context: AgentRuntimeContext = {
      enabledTools: [],
      enabledMcps: ["websearch", "context7", "grep_app"],
      enabledAgents: {},
    }
    const section = buildRuntimeContextSection(context, "bytes")
    expect(section).toContain("web search and page fetching")
    expect(section).toContain("library/framework documentation lookup")
    expect(section).toContain("GitHub code search across public repositories")
  })

  it("unknown MCP names appear without description", () => {
    const context: AgentRuntimeContext = {
      enabledTools: [],
      enabledMcps: ["custom-mcp"],
      enabledAgents: {},
    }
    const section = buildRuntimeContextSection(context, "bytes")
    expect(section).toContain("custom-mcp")
    // No parenthetical description
    expect(section).not.toContain("custom-mcp (")
  })
})

describe("computeRuntimeContext", () => {
  it("filters out disabled agents", () => {
    const agents: Record<string, AgentConfig> = {
      bytes: { description: "Primary", disable: false },
      oracle: { description: "Oracle", disable: true },
      explore: { description: "Explore" },
    }
    const ctx = computeRuntimeContext(agents, ["websearch"], ["grep"])
    expect(ctx.enabledAgents).toHaveProperty("bytes")
    expect(ctx.enabledAgents).not.toHaveProperty("oracle")
    expect(ctx.enabledAgents).toHaveProperty("explore")
  })

  it("uses agent name as fallback when description is missing", () => {
    const agents: Record<string, AgentConfig> = {
      bytes: {},
    }
    const ctx = computeRuntimeContext(agents, [], [])
    expect(ctx.enabledAgents.bytes).toBe("bytes")
  })

  it("passes through enabled MCP and tool names unchanged", () => {
    const mcps = ["websearch", "context7"]
    const tools = ["hashline_edit", "grep", "glob"]
    const ctx = computeRuntimeContext({}, mcps, tools)
    expect(ctx.enabledMcps).toEqual(mcps)
    expect(ctx.enabledTools).toEqual(tools)
  })
})

describe("appendRuntimeContextToAgents — edge cases", () => {
  it("edge case: all agents disabled — nothing appended", () => {
    const agents: Record<string, AgentConfig> = {
      bytes: { prompt: "I am bytes.", disable: true },
      explore: { prompt: "I am explore.", disable: true },
    }
    const context: AgentRuntimeContext = {
      enabledTools: ["grep"],
      enabledMcps: ["websearch"],
      enabledAgents: {},
    }

    appendRuntimeContextToAgents(agents, context)

    for (const agent of Object.values(agents)) {
      expect(agent.prompt).not.toContain("<available_resources>")
    }
  })

  it("only enabled agents get the resources section appended", () => {
    const agents: Record<string, AgentConfig> = {
      bytes: { prompt: "I am bytes." },
      oracle: { prompt: "I am oracle.", disable: true },
    }
    const context: AgentRuntimeContext = {
      enabledTools: ["grep"],
      enabledMcps: [],
      enabledAgents: { bytes: "Primary coding agent" },
    }

    appendRuntimeContextToAgents(agents, context)

    expect(agents.bytes.prompt).toContain("<available_resources>")
    expect(agents.oracle.prompt).not.toContain("<available_resources>")
  })

  it("disabled MCPs do not appear in the appended section", () => {
    const agents: Record<string, AgentConfig> = {
      bytes: { prompt: "Hello." },
    }
    // Only context7 is enabled — websearch is not in the list (disabled)
    const context: AgentRuntimeContext = {
      enabledTools: [],
      enabledMcps: ["context7"],
      enabledAgents: {},
    }

    appendRuntimeContextToAgents(agents, context)

    expect(agents.bytes.prompt).toContain("context7")
    // websearch should not appear as a listed server
    expect(agents.bytes.prompt).toContain("MCP servers: context7")
    expect(agents.bytes.prompt).not.toContain("websearch (web search")
  })

  it("disabled tools do not appear in the appended section", () => {
    const agents: Record<string, AgentConfig> = {
      bytes: { prompt: "Hello." },
    }
    // hashline_edit is NOT in enabledTools (disabled)
    const context: AgentRuntimeContext = {
      enabledTools: ["grep"],
      enabledMcps: [],
      enabledAgents: {},
    }

    appendRuntimeContextToAgents(agents, context)

    expect(agents.bytes.prompt).toContain("grep")
    expect(agents.bytes.prompt).not.toContain("hashline_edit")
  })
})
