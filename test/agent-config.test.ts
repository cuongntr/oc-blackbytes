import { describe, expect, it } from "bun:test"
import type { AgentConfig } from "@opencode-ai/sdk/v2"
import {
  type AgentRuntimeContext,
  appendRuntimeContextToAgents,
} from "../src/extensions/agents/utils/runtime-context"

const baseContext: AgentRuntimeContext = {
  enabledTools: ["hashline_edit", "grep"],
  enabledMcps: ["websearch", "context7"],
  enabledAgents: {
    bytes: "Primary coding agent",
    explore: "Contextual grep for codebases",
  },
}

describe("appendRuntimeContextToAgents", () => {
  it("appends <available_resources> section to agent prompts", () => {
    const agents: Record<string, AgentConfig> = {
      bytes: { prompt: "You are a coding agent." },
    }

    appendRuntimeContextToAgents(agents, baseContext)

    expect(agents.bytes.prompt).toContain("<available_resources>")
    expect(agents.bytes.prompt).toContain("hashline_edit")
    expect(agents.bytes.prompt).toContain("websearch")
  })

  it("is idempotent — calling twice does not duplicate <available_resources>", () => {
    const agents: Record<string, AgentConfig> = {
      bytes: { prompt: "You are a coding agent." },
      explore: { prompt: "You are a search agent." },
    }

    appendRuntimeContextToAgents(agents, baseContext)
    appendRuntimeContextToAgents(agents, baseContext)

    for (const agent of Object.values(agents)) {
      const prompt = agent.prompt ?? ""
      const occurrences = (prompt.match(/<available_resources>/g) ?? []).length
      expect(occurrences).toBe(1)
    }
  })

  it("skips agents with disable: true", () => {
    const agents: Record<string, AgentConfig> = {
      bytes: { prompt: "You are a coding agent.", disable: true },
      explore: { prompt: "You are a search agent." },
    }

    appendRuntimeContextToAgents(agents, baseContext)

    expect(agents.bytes.prompt).not.toContain("<available_resources>")
    expect(agents.explore.prompt).toContain("<available_resources>")
  })

  it("skips agents without a prompt", () => {
    const agents: Record<string, AgentConfig> = {
      noPrompt: {},
      emptyPrompt: { prompt: "" },
      withPrompt: { prompt: "I have a prompt." },
    }

    appendRuntimeContextToAgents(agents, baseContext)

    expect(agents.noPrompt.prompt).toBeUndefined()
    expect(agents.emptyPrompt.prompt).toBe("")
    expect(agents.withPrompt.prompt).toContain("<available_resources>")
  })

  it("excludes the agent itself from the peer agents list", () => {
    const agents: Record<string, AgentConfig> = {
      bytes: { prompt: "You are bytes." },
    }
    const ctx: AgentRuntimeContext = {
      ...baseContext,
      enabledAgents: { bytes: "Primary coding agent", explore: "Search agent" },
    }

    appendRuntimeContextToAgents(agents, ctx)

    // bytes should see explore but not itself
    expect(agents.bytes.prompt).toContain("explore")
    expect(agents.bytes.prompt).not.toMatch(/- bytes:/)
  })

  it("handles empty context gracefully — no resources means no section appended", () => {
    const agents: Record<string, AgentConfig> = {
      bytes: { prompt: "You are a coding agent." },
    }
    const emptyContext: AgentRuntimeContext = {
      enabledTools: [],
      enabledMcps: [],
      enabledAgents: { bytes: "desc" }, // only self — no peers
    }

    appendRuntimeContextToAgents(agents, emptyContext)

    // When only self is in enabledAgents and no tools/MCPs, no section should be appended
    expect(agents.bytes.prompt).not.toContain("<available_resources>")
  })
})
