/**
 * E2E scenario ocb-3r3.14.1: Full plugin bootstrap against minimal config.
 *
 * Loads the plugin with an empty {} config (minimal fixture) and invokes the
 * config hook. Asserts all built-in MCPs, agents, and commands are present,
 * and that default_agent is "bytes".
 */
import { describe, expect, it } from "bun:test"
import { makeTmpDir } from "../helpers/tmp-dir"
import { runE2EScenario } from "./runner"

describe("E2E 14.1: bootstrap with minimal config", () => {
  it("provisions all built-in MCPs (websearch, context7, grep_app)", async () => {
    const tmp = makeTmpDir("oc-bb-bootstrap-")
    const result = await runE2EScenario({
      scenario: "bootstrap-mcps",
      fixture: "minimal",
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
    expect(mcp).toBeDefined()
    expect(mcp?.websearch).toBeDefined()
    expect(mcp?.context7).toBeDefined()
    expect(mcp?.grep_app).toBeDefined()
  })

  it("provisions all built-in agents (bytes, explore, oracle, librarian, general)", async () => {
    const tmp = makeTmpDir("oc-bb-bootstrap-agents-")
    const result = await runE2EScenario({
      scenario: "bootstrap-agents",
      fixture: "minimal",
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
    expect(agent).toBeDefined()
    expect(agent?.bytes).toBeDefined()
    expect(agent?.explore).toBeDefined()
    expect(agent?.oracle).toBeDefined()
    expect(agent?.librarian).toBeDefined()
    expect(agent?.general).toBeDefined()
  })

  it("sets default_agent=bytes", async () => {
    const tmp = makeTmpDir("oc-bb-bootstrap-default-")
    const result = await runE2EScenario({
      scenario: "bootstrap-default-agent",
      fixture: "minimal",
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
    expect(config?.default_agent).toBe("bytes")
  })

  it("registers built-in commands", async () => {
    const tmp = makeTmpDir("oc-bb-bootstrap-cmds-")
    const result = await runE2EScenario({
      scenario: "bootstrap-commands",
      fixture: "minimal",
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
    const command = config?.command as Record<string, unknown>
    expect(command).toBeDefined()
    // At least one built-in command should be registered (e.g. setup-models)
    expect(Object.keys(command).length).toBeGreaterThan(0)
  })

  it("registers bundled tools (hashline_edit, ast_grep_search, grep, glob)", async () => {
    const tmp = makeTmpDir("oc-bb-bootstrap-tools-")
    const result = await runE2EScenario({
      scenario: "bootstrap-tools",
      fixture: "minimal",
      artifactRoot: tmp.path,
      steps: [
        {
          name: "inspect-tool-registry",
          hook: "tool",
          // No invoke — auto-dispatches to hooks.tool (the registry object)
        },
      ],
    })

    await tmp.cleanup()

    expect(result.success).toBe(true)
    const registry = result.steps[0]?.output as Record<string, unknown>
    expect(registry?.hashline_edit).toBeDefined()
    expect(registry?.ast_grep_search).toBeDefined()
    expect(registry?.ast_grep_replace).toBeDefined()
    expect(registry?.grep).toBeDefined()
    expect(registry?.glob).toBeDefined()
  })
})
