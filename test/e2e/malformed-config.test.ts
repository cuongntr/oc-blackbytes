/**
 * E2E scenario ocb-3r3.14.9: malformed config → graceful degradation with clear warning.
 *
 * Points the runner at the malformed fixture (disabled_mcps is a string,
 * not an array). The plugin does NOT throw — instead it logs a clear warning
 * and falls back to an empty {} config (default built-ins).
 *
 * Asserts:
 *  - The plugin still loads and the config hook succeeds (graceful degradation).
 *  - A human-readable warning is printed to console.warn.
 *  - The resulting config falls back to defaults (all built-in MCPs/agents present).
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { makeTmpDir } from "../helpers/tmp-dir"
import { runE2EScenario } from "./runner"

describe("E2E 14.9: malformed config → graceful degradation with clear warning", () => {
  let warnMessages: string[]
  let originalWarn: typeof console.warn

  beforeEach(() => {
    warnMessages = []
    originalWarn = console.warn
    console.warn = (...args: unknown[]) => {
      warnMessages.push(args.map(String).join(" "))
    }
  })

  afterEach(() => {
    console.warn = originalWarn
  })

  it("plugin still loads successfully despite malformed config (graceful degradation)", async () => {
    const tmp = makeTmpDir("oc-bb-malformed-")
    const result = await runE2EScenario({
      scenario: "malformed-config",
      fixture: "malformed",
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

    // Plugin degrades gracefully: loads with empty {} config instead of throwing
    expect(result.success).toBe(true)
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0]?.ok).toBe(true)
  })

  it("emits a human-readable warning when config is malformed", async () => {
    const tmp = makeTmpDir("oc-bb-malformed-warn-")
    await runE2EScenario({
      scenario: "malformed-config-warn",
      fixture: "malformed",
      artifactRoot: tmp.path,
      steps: [
        {
          name: "noop-step",
          hook: "tool",
        },
      ],
    })

    await tmp.cleanup()

    // The plugin emits a warning via console.warn about the schema validation error
    const allWarnings = warnMessages.join("\n")
    expect(allWarnings.length).toBeGreaterThan(0)
    // Warning should mention the config file or validation issue
    const lowerWarnings = allWarnings.toLowerCase()
    const mentionsIssue =
      lowerWarnings.includes("disabled_mcps") ||
      lowerWarnings.includes("array") ||
      lowerWarnings.includes("expected") ||
      lowerWarnings.includes("invalid") ||
      lowerWarnings.includes("validation") ||
      lowerWarnings.includes("schema") ||
      lowerWarnings.includes("oc-blackbytes")
    expect(mentionsIssue).toBe(true)
  })

  it("falls back to default built-in config (all MCPs and agents present) on malformed input", async () => {
    const tmp = makeTmpDir("oc-bb-malformed-fallback-")
    const result = await runE2EScenario({
      scenario: "malformed-config-fallback",
      fixture: "malformed",
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

    // With fallback to {}, all built-in MCPs should be present
    const mcp = config?.mcp as Record<string, unknown>
    expect(mcp?.websearch).toBeDefined()
    expect(mcp?.context7).toBeDefined()
    expect(mcp?.grep_app).toBeDefined()

    // All built-in agents should be present
    const agent = config?.agent as Record<string, unknown>
    expect(agent?.bytes).toBeDefined()
    expect(agent?.explore).toBeDefined()
    expect(agent?.oracle).toBeDefined()
    expect(agent?.librarian).toBeDefined()
    expect(agent?.general).toBeDefined()
    expect(agent?.reviewer).toBeDefined()
  })
})
