import { describe, expect, it } from "bun:test"
import type { AgentConfig } from "@opencode-ai/sdk/v2"
import { createExploreAgent } from "../../src/extensions/agents/explore"
import { createGeneralAgent } from "../../src/extensions/agents/general"
import { createLibrarianAgent } from "../../src/extensions/agents/librarian"
import { createOracleAgent } from "../../src/extensions/agents/oracle"

const TEST_MODEL = "claude-3-5-sonnet"
const TEST_GPT_MODEL = "gpt-4o"

// ---------------------------------------------------------------------------
// Helper: assert common AgentConfig shape
// ---------------------------------------------------------------------------

function assertAgentShape(agent: AgentConfig, _opts: { name: string }) {
  expect(typeof agent.description).toBe("string")
  expect(agent.description?.length ?? 0).toBeGreaterThan(0)

  expect(typeof agent.prompt).toBe("string")
  expect(agent.prompt?.length ?? 0).toBeGreaterThan(0)

  expect(typeof agent.model).toBe("string")
  expect(agent.mode).toBeDefined()

  // Permission map should exist (from createAgentToolRestrictions spread)
  expect(agent.permission).toBeDefined()
  expect(typeof agent.permission).toBe("object")

  // Language matching instruction must be present in prompt
  expect(agent.prompt).toMatch(/detect the language/i)
}

// ---------------------------------------------------------------------------
// explore
// ---------------------------------------------------------------------------

describe("createExploreAgent", () => {
  it("returns an agent with the correct name-aligned description", () => {
    const agent = createExploreAgent(TEST_MODEL)
    assertAgentShape(agent, { name: "explore" })
    expect(agent.description).toContain("grep")
  })

  it("sets mode to 'subagent'", () => {
    const agent = createExploreAgent(TEST_MODEL)
    expect(agent.mode).toBe("subagent")
    expect(createExploreAgent.mode).toBe("subagent")
  })

  it("prompt describes the exploration mandate", () => {
    const agent = createExploreAgent(TEST_MODEL)
    expect(agent.prompt).toContain("codebase")
    expect(agent.prompt).toContain("search")
  })

  it("denies write/edit/apply_patch/hashline_edit/ast_grep_replace", () => {
    const agent = createExploreAgent(TEST_MODEL)
    const denied = ["write", "edit", "apply_patch", "hashline_edit", "ast_grep_replace"]
    for (const tool of denied) {
      expect(agent.permission?.[tool]).toBe("deny")
    }
  })

  it("uses the provided model", () => {
    const agent = createExploreAgent("gemini-pro")
    expect(agent.model).toBe("gemini-pro")
  })

  it("prompt contains language-matching instructions", () => {
    const agent = createExploreAgent(TEST_MODEL)
    expect(agent.prompt).toMatch(/detect the language/i)
  })

  it("uses OpenCode core lsp conditionally with local-search fallbacks", () => {
    const agent = createExploreAgent(TEST_MODEL)

    expect(agent.prompt).toContain("OpenCode core `lsp` tool")
    expect(agent.prompt).toContain("use it conditionally")
    expect(agent.prompt).toContain("fall back to grep/glob/ast_grep_search/read")
    expect(agent.prompt).not.toContain("LSP tools")
  })
})

// ---------------------------------------------------------------------------
// oracle
// ---------------------------------------------------------------------------

describe("createOracleAgent", () => {
  it("returns an agent with correct structure for default (Claude) model", () => {
    const agent = createOracleAgent(TEST_MODEL)
    assertAgentShape(agent, { name: "oracle" })
    expect(agent.description).toContain("Read-only")
  })

  it("sets mode to 'subagent'", () => {
    const agent = createOracleAgent(TEST_MODEL)
    expect(agent.mode).toBe("subagent")
    expect(createOracleAgent.mode).toBe("subagent")
  })

  it("uses GPT-optimized prompt for GPT models", () => {
    const defaultAgent = createOracleAgent(TEST_MODEL)
    const gptAgent = createOracleAgent(TEST_GPT_MODEL)

    // Both should have non-empty prompts
    expect(defaultAgent.prompt?.length ?? 0).toBeGreaterThan(0)
    expect(gptAgent.prompt?.length ?? 0).toBeGreaterThan(0)

    // GPT agent gets extra fields
    expect((gptAgent as AgentConfig & { reasoningEffort?: string }).reasoningEffort).toBe("medium")
  })

  it("denies write/edit/apply_patch/hashline_edit/ast_grep_replace", () => {
    const agent = createOracleAgent(TEST_MODEL)
    const denied = ["write", "edit", "apply_patch", "hashline_edit", "ast_grep_replace"]
    for (const tool of denied) {
      expect(agent.permission?.[tool]).toBe("deny")
    }
  })

  it("prompt contains language-matching instructions", () => {
    const agent = createOracleAgent(TEST_MODEL)
    expect(agent.prompt).toMatch(/detect the language/i)
  })

  it("GPT prompt also contains language-matching instructions", () => {
    const agent = createOracleAgent(TEST_GPT_MODEL)
    expect(agent.prompt).toMatch(/detect the language/i)
  })
})

// ---------------------------------------------------------------------------
// librarian
// ---------------------------------------------------------------------------

describe("createLibrarianAgent", () => {
  it("returns an agent with correct structure", () => {
    const agent = createLibrarianAgent(TEST_MODEL)
    assertAgentShape(agent, { name: "librarian" })
    expect(agent.description).toContain("codebase")
  })

  it("sets mode to 'subagent'", () => {
    const agent = createLibrarianAgent(TEST_MODEL)
    expect(agent.mode).toBe("subagent")
    expect(createLibrarianAgent.mode).toBe("subagent")
  })

  it("prompt describes the librarian mandate (open-source research)", () => {
    const agent = createLibrarianAgent(TEST_MODEL)
    expect(agent.prompt).toContain("LIBRARIAN")
    expect(agent.prompt).toContain("open-source")
  })

  it("denies write/edit/apply_patch/hashline_edit/ast_grep_replace", () => {
    const agent = createLibrarianAgent(TEST_MODEL)
    const denied = ["write", "edit", "apply_patch", "hashline_edit", "ast_grep_replace"]
    for (const tool of denied) {
      expect(agent.permission?.[tool]).toBe("deny")
    }
  })

  it("explicitly allows read, bash, and external_directory", () => {
    const agent = createLibrarianAgent(TEST_MODEL)
    expect(agent.permission?.read).toBe("allow")
    expect(agent.permission?.bash).toBe("allow")
    expect(agent.permission?.external_directory).toBe("allow")
  })

  it("prompt contains language-matching instructions", () => {
    const agent = createLibrarianAgent(TEST_MODEL)
    expect(agent.prompt).toMatch(/detect the language/i)
  })
})

// ---------------------------------------------------------------------------
// general
// ---------------------------------------------------------------------------

describe("createGeneralAgent", () => {
  it("returns an agent with correct structure for default (Claude) model", () => {
    const agent = createGeneralAgent(TEST_MODEL)
    assertAgentShape(agent, { name: "general" })
    expect(agent.description).toContain("executor")
  })

  it("sets mode to 'subagent'", () => {
    const agent = createGeneralAgent(TEST_MODEL)
    expect(agent.mode).toBe("subagent")
    expect(createGeneralAgent.mode).toBe("subagent")
  })

  it("only denies 'compress' — has near-full write access", () => {
    const agent = createGeneralAgent(TEST_MODEL)
    expect(agent.permission?.compress).toBe("deny")
    // write/edit should NOT be denied
    expect(agent.permission?.write).toBeUndefined()
    expect(agent.permission?.edit).toBeUndefined()
  })

  it("uses GPT-optimized prompt for GPT models", () => {
    const defaultAgent = createGeneralAgent(TEST_MODEL)
    const gptAgent = createGeneralAgent(TEST_GPT_MODEL)

    expect(defaultAgent.prompt?.length ?? 0).toBeGreaterThan(0)
    expect(gptAgent.prompt?.length ?? 0).toBeGreaterThan(0)

    // GPT agent gets extra fields
    expect((gptAgent as AgentConfig & { reasoningEffort?: string }).reasoningEffort).toBe("medium")
  })

  it("prompt contains language-matching instructions", () => {
    const agent = createGeneralAgent(TEST_MODEL)
    expect(agent.prompt).toMatch(/detect the language/i)
  })

  it("GPT prompt also contains language-matching instructions", () => {
    const agent = createGeneralAgent(TEST_GPT_MODEL)
    expect(agent.prompt).toMatch(/detect the language/i)
  })

  it("prompt instructs not to spawn other General agents", () => {
    const agent = createGeneralAgent(TEST_MODEL)
    expect(agent.prompt).toMatch(/general/i)
  })

  it("uses OpenCode core lsp conditionally with local-search fallbacks", () => {
    const defaultAgent = createGeneralAgent(TEST_MODEL)
    const gptAgent = createGeneralAgent(TEST_GPT_MODEL)

    for (const agent of [defaultAgent, gptAgent]) {
      expect(agent.prompt).toContain("OpenCode core `lsp`")
      expect(agent.prompt).toContain("conditionally")
      expect(agent.prompt).toContain("grep/glob/ast_grep_search/read")
      expect(agent.prompt).not.toContain("LSP tools")
    }
  })
})
