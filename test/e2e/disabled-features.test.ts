/**
 * E2E scenario ocb-3r3.14.2: disabled_mcps / disabled_agents / disabled_tools.
 *
 * Uses the partial-disabled fixture which disables:
 *   - MCP: websearch
 *   - Agent: explore
 *   - Tool: hashline_edit
 *
 * Verifies each disabled item is absent from the final config, tool registry,
 * and that the bytes agent's <available_resources> prompt section omits them.
 */
import { describe, expect, it } from "bun:test"
import { makeTmpDir } from "../helpers/tmp-dir"
import { runE2EScenario } from "./runner"

describe("E2E 14.2: disabled_mcps / disabled_agents / disabled_tools", () => {
  it("disabled MCP (websearch) is absent from config.mcp", async () => {
    const tmp = makeTmpDir("oc-bb-disabled-mcp-")
    const result = await runE2EScenario({
      scenario: "disabled-mcp",
      fixture: "partial-disabled",
      artifactRoot: tmp.path,
      steps: [
        {
          name: "invoke-config-hook",
          hook: "config",
          invoke: async (hooks) => {
            const configFn = (hooks as Record<string, unknown>).config as (
              input: Record<string, unknown>,
            ) => Promise<void>
            const config: Record<string, unknown> = {}
            await configFn(config)
            return config
          },
        },
      ],
    })

    await tmp.cleanup()

    expect(result.success).toBe(true)
    const config = result.steps[0]?.output as Record<string, unknown>
    const mcp = config?.mcp as Record<string, unknown>
    // websearch should be absent
    expect(mcp?.websearch).toBeUndefined()
    // context7 and grep_app should still be present
    expect(mcp?.context7).toBeDefined()
    expect(mcp?.grep_app).toBeDefined()
  })

  it("disabled agent (explore) is absent from config.agent", async () => {
    const tmp = makeTmpDir("oc-bb-disabled-agent-")
    const result = await runE2EScenario({
      scenario: "disabled-agent",
      fixture: "partial-disabled",
      artifactRoot: tmp.path,
      steps: [
        {
          name: "invoke-config-hook",
          hook: "config",
          invoke: async (hooks) => {
            const configFn = (hooks as Record<string, unknown>).config as (
              input: Record<string, unknown>,
            ) => Promise<void>
            const config: Record<string, unknown> = {}
            await configFn(config)
            return config
          },
        },
      ],
    })

    await tmp.cleanup()

    expect(result.success).toBe(true)
    const config = result.steps[0]?.output as Record<string, unknown>
    const agent = config?.agent as Record<string, unknown>
    // explore should be absent
    expect(agent?.explore).toBeUndefined()
    // bytes, oracle, librarian, general, reviewer should still be present
    expect(agent?.bytes).toBeDefined()
    expect(agent?.oracle).toBeDefined()
    expect(agent?.librarian).toBeDefined()
    expect(agent?.general).toBeDefined()
    expect(agent?.reviewer).toBeDefined()
  })

  it("disabled tool (hashline_edit) is absent from the tool registry", async () => {
    const tmp = makeTmpDir("oc-bb-disabled-tool-")
    const result = await runE2EScenario({
      scenario: "disabled-tool",
      fixture: "partial-disabled",
      artifactRoot: tmp.path,
      steps: [
        {
          name: "inspect-tool-registry",
          hook: "tool",
        },
      ],
    })

    await tmp.cleanup()

    expect(result.success).toBe(true)
    const registry = result.steps[0]?.output as Record<string, unknown>
    // hashline_edit should be absent
    expect(registry?.hashline_edit).toBeUndefined()
    // other tools should still be present
    expect(registry?.ast_grep_search).toBeDefined()
    expect(registry?.grep).toBeDefined()
    expect(registry?.glob).toBeDefined()
  })

  it("disabled items are omitted from bytes agent <available_resources> prompt", async () => {
    const tmp = makeTmpDir("oc-bb-disabled-prompt-")
    const result = await runE2EScenario({
      scenario: "disabled-resources-prompt",
      fixture: "partial-disabled",
      artifactRoot: tmp.path,
      steps: [
        {
          name: "invoke-config-hook",
          hook: "config",
          invoke: async (hooks) => {
            const configFn = (hooks as Record<string, unknown>).config as (
              input: Record<string, unknown>,
            ) => Promise<void>
            const config: Record<string, unknown> = {}
            await configFn(config)
            return config
          },
        },
      ],
    })

    await tmp.cleanup()

    expect(result.success).toBe(true)
    const config = result.steps[0]?.output as Record<string, unknown>
    const agent = config?.agent as Record<string, unknown>
    const bytesAgent = agent?.bytes as Record<string, unknown>
    const prompt = bytesAgent?.prompt as string
    expect(typeof prompt).toBe("string")

    // The disabled items should not appear in the available_resources section
    const resourcesSection = prompt.slice(prompt.lastIndexOf("<available_resources>"))

    // Check MCP servers line — websearch should not be listed there
    const mcpServersLine =
      resourcesSection.split("\n").find((l) => l.startsWith("MCP servers:")) ?? ""
    expect(mcpServersLine).not.toContain("websearch")
    expect(mcpServersLine).toContain("context7")
    expect(mcpServersLine).toContain("grep_app")

    // Check that the explore agent is not in the Available agents section
    const agentsSection = resourcesSection.slice(resourcesSection.indexOf("Available agents:"))
    expect(agentsSection).not.toContain("- explore:")

    // Check bundled tools — hashline_edit should not be listed
    const toolsLine =
      resourcesSection
        .split("\n")
        .find((l) => l.startsWith("Bundled tools (oc-blackbytes-managed):")) ?? ""
    expect(toolsLine).not.toContain("hashline_edit")
    // Other tools should still appear
    expect(toolsLine).toContain("grep")
    expect(toolsLine).toContain("glob")
  })
})
