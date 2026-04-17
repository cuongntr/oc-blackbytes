import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import path from "node:path"
import { loadPlugin } from "../helpers/plugin-harness"
import { makeTmpDir, writeJsoncFixture } from "../helpers/tmp-dir"

type ChatParamsHook = (
  input: {
    agent: string
    model: {
      providerID: string
      id: string
      capabilities?: { reasoning?: boolean }
    }
  },
  output: {
    options: Record<string, unknown>
    temperature?: number
  },
) => Promise<void>

interface TestCase {
  desc: string
  agent: string
  providerID: string
  modelID: string
  supportsReasoning: boolean
  expectThinking?: boolean
  expectReasoningEffort?: boolean
  expectNoThinking?: boolean
  expectNoReasoningEffort?: boolean
}

const MATRIX: TestCase[] = [
  {
    desc: "claude + bytes + reasoning → thinking config applied",
    agent: "bytes",
    providerID: "anthropic",
    modelID: "claude-sonnet-4-6",
    supportsReasoning: true,
    expectThinking: true,
  },
  {
    desc: "claude + bytes + NO reasoning → no thinking config",
    agent: "bytes",
    providerID: "anthropic",
    modelID: "claude-sonnet-4-6",
    supportsReasoning: false,
    expectNoThinking: true,
    expectNoReasoningEffort: true,
  },
  {
    desc: "openai + bytes + reasoning → reasoningEffort config applied",
    agent: "bytes",
    providerID: "openai",
    modelID: "gpt-4o",
    supportsReasoning: true,
    expectReasoningEffort: true,
    expectNoThinking: true,
  },
  {
    desc: "openai + oracle + reasoning → reasoningEffort=high",
    agent: "oracle",
    providerID: "openai",
    modelID: "o3",
    supportsReasoning: true,
    expectReasoningEffort: true,
    expectNoThinking: true,
  },
  {
    desc: "gemini + bytes → thinking stripped, no reasoning effort",
    agent: "bytes",
    providerID: "google",
    modelID: "gemini-2.0-flash",
    supportsReasoning: false,
    expectNoThinking: true,
    expectNoReasoningEffort: true,
  },
  {
    desc: "unknown provider + agent → no-op (no thinking, no reasoningEffort)",
    agent: "bytes",
    providerID: "my-custom-llm",
    modelID: "custom-7b",
    supportsReasoning: false,
    expectNoThinking: true,
    expectNoReasoningEffort: true,
  },
  {
    desc: "claude + explore (no budget agent) + reasoning → no thinking config",
    agent: "explore",
    providerID: "anthropic",
    modelID: "claude-haiku-3-5",
    supportsReasoning: true,
    expectNoThinking: true,
    expectNoReasoningEffort: true,
  },
]

describe("handlers/chat-params-handler", () => {
  let dir: string
  let cleanup: () => Promise<void>
  let hook: ChatParamsHook

  beforeEach(async () => {
    const tmp = makeTmpDir("oc-bb-chat-params-")
    dir = tmp.path
    cleanup = tmp.cleanup
    writeJsoncFixture(path.join(dir, "oc-blackbytes.json"), {})
    const hooks = await loadPlugin({ configDir: dir, directory: dir, worktree: dir })
    hook = hooks["chat.params"] as ChatParamsHook
  })

  afterEach(async () => {
    await cleanup()
  })

  for (const tc of MATRIX) {
    it(tc.desc, async () => {
      const output = { options: { thinking: { type: "enabled" }, reasoningEffort: "low" } }
      await hook(
        {
          agent: tc.agent,
          model: {
            providerID: tc.providerID,
            id: tc.modelID,
            capabilities: { reasoning: tc.supportsReasoning },
          },
        },
        output,
      )

      if (tc.expectThinking) {
        expect(output.options.thinking).toBeDefined()
        const thinking = output.options.thinking as { type: string }
        expect(["adaptive", "enabled"]).toContain(thinking.type)
      }
      if (tc.expectNoThinking) {
        expect(output.options.thinking).toBeUndefined()
      }
      if (tc.expectReasoningEffort) {
        expect(output.options.reasoningEffort).toBeDefined()
        expect(typeof output.options.reasoningEffort).toBe("string")
      }
      if (tc.expectNoReasoningEffort) {
        expect(output.options.reasoningEffort).toBeUndefined()
      }
    })
  }

  it("always strips textVerbosity from output options", async () => {
    const output = { options: { textVerbosity: "high" } }
    await hook(
      {
        agent: "bytes",
        model: { providerID: "openai", id: "gpt-4o", capabilities: { reasoning: false } },
      },
      output,
    )
    expect(output.options.textVerbosity).toBeUndefined()
  })

  it("applies user temperature override from plugin config", async () => {
    const tmp2 = makeTmpDir("oc-bb-chat-params-temp-")
    try {
      writeJsoncFixture(path.join(tmp2.path, "oc-blackbytes.json"), {
        agents: { bytes: { temperature: 0.1 } },
      })
      const hooks2 = await loadPlugin({
        configDir: tmp2.path,
        directory: tmp2.path,
        worktree: tmp2.path,
      })
      const hook2 = hooks2["chat.params"] as ChatParamsHook
      const output = { options: {} }
      await hook2(
        {
          agent: "bytes",
          model: {
            providerID: "anthropic",
            id: "claude-sonnet-4-6",
            capabilities: { reasoning: false },
          },
        },
        output,
      )
      expect(output.temperature).toBe(0.1)
    } finally {
      await tmp2.cleanup()
    }
  })
})
