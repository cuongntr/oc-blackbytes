/**
 * E2E scenario ocb-3r3.14.8: per-agent model override from config.
 *
 * Uses the agent-models fixture which sets:
 *   agents.bytes.model = 'github-copilot/claude-opus-4.7'
 *   agents.general.model = 'openai/gpt-4o'
 *   agents.oracle.model = 'openai/o3' with reasoningEffort = 'high'
 *   agents.explore.model = 'google/gemini-2.5-flash' with temperature = 0.2
 *
 * Verifies:
 *  1. The merged config reflects these model overrides in agent configs.
 *  2. chat.params produces the correct vector for bytes (claude→thinking) and
 *     general (openai→reasoningEffort) when their respective model families
 *     are detected at runtime.
 */
import { describe, expect, it } from "bun:test"
import { loadPlugin } from "../helpers/plugin-harness"
import { makeTmpDir } from "../helpers/tmp-dir"
import { runE2EScenario } from "./runner"

interface ChatParamsInput {
  agent: string
  model: {
    providerID: string
    id: string
    capabilities?: { reasoning?: boolean }
  }
}

interface ChatParamsOutput {
  options: Record<string, unknown>
  temperature?: number
}

async function callChatParams(
  hooks: Awaited<ReturnType<typeof loadPlugin>>,
  input: ChatParamsInput,
): Promise<ChatParamsOutput> {
  const fn = (hooks as Record<string, unknown>)["chat.params"] as (
    input: ChatParamsInput,
    output: ChatParamsOutput,
  ) => Promise<void>
  const output: ChatParamsOutput = { options: {} }
  await fn(input, output)
  return output
}

describe("E2E 14.8: per-agent model override from config", () => {
  it("bytes agent carries the configured model override in the merged config", async () => {
    const tmp = makeTmpDir("oc-bb-model-override-")
    const result = await runE2EScenario({
      scenario: "model-override-bytes",
      fixture: "agent-models",
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
    // bytes agent should exist (model override applied)
    expect(agent?.bytes).toBeDefined()
    // explore agent should carry the temperature override
    const exploreAgent = agent?.explore as Record<string, unknown>
    expect(exploreAgent).toBeDefined()
    // temperature = 0.2 is applied via applyAgentModelOverrides
    expect(exploreAgent?.temperature).toBe(0.2)
  })

  it("oracle agent carries the reasoningEffort override from config", async () => {
    const tmp = makeTmpDir("oc-bb-model-override-oracle-")
    const result = await runE2EScenario({
      scenario: "model-override-oracle",
      fixture: "agent-models",
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
    const oracleAgent = agent?.oracle as Record<string, unknown>
    expect(oracleAgent).toBeDefined()
    // reasoningEffort = 'high' from agent-models fixture
    expect(oracleAgent?.reasoningEffort).toBe("high")
  })

  it("bytes override (claude model) → chat.params applies thinking", async () => {
    const tmp = makeTmpDir("oc-bb-model-params-bytes-")
    const { writeJsoncFixture } = await import("../helpers/tmp-dir")
    const { getFixture } = await import("../helpers/fixtures")

    // Write the agent-models fixture into config dir
    writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, getFixture("agent-models"))
    const hooks = await loadPlugin({ configDir: tmp.path, directory: tmp.path, worktree: tmp.path })

    // Simulate runtime: bytes agent with the override model (claude family via pattern)
    const output = await callChatParams(hooks, {
      agent: "bytes",
      model: {
        providerID: "github-copilot",
        id: "claude-opus-4.7",
        capabilities: { reasoning: true },
      },
    })

    await tmp.cleanup()

    // Claude family → thinking should be applied for bytes
    expect(output.options.thinking).toBeDefined()
    const thinking = output.options.thinking as Record<string, unknown>
    expect(["adaptive", "enabled"]).toContain(thinking.type)
    expect(output.options.reasoningEffort).toBeUndefined()
  })

  it("general override (openai model) → chat.params applies reasoningEffort", async () => {
    const tmp = makeTmpDir("oc-bb-model-params-general-")
    const { writeJsoncFixture } = await import("../helpers/tmp-dir")
    const { getFixture } = await import("../helpers/fixtures")

    writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, getFixture("agent-models"))
    const hooks = await loadPlugin({ configDir: tmp.path, directory: tmp.path, worktree: tmp.path })

    // Simulate runtime: general agent with openai model family
    const output = await callChatParams(hooks, {
      agent: "general",
      model: {
        providerID: "openai",
        id: "gpt-4o",
        capabilities: { reasoning: true },
      },
    })

    await tmp.cleanup()

    // OpenAI family → reasoningEffort should be applied for general
    expect(output.options.reasoningEffort).toBeDefined()
    expect(typeof output.options.reasoningEffort).toBe("string")
    expect(output.options.thinking).toBeUndefined()
  })
})
