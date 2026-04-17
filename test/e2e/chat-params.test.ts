/**
 * E2E scenario ocb-3r3.14.4: chat.params across model families.
 *
 * Drives the chat.params hook for:
 *   - claude-opus-4.7 (Anthropic/Claude family)
 *   - gpt-5 (OpenAI family)
 *   - gemini-2.5-pro (Gemini family)
 *   - unknown-model (unknown family)
 *
 * For each model, tests against bytes, oracle, and general agents.
 * Asserts the parameters vector (thinking/reasoningEffort/etc.) matches the
 * handler contract.
 */
import { describe, expect, it } from "bun:test"
import { loadPlugin } from "../helpers/plugin-harness"
import { makeTmpDir, writeJsoncFixture } from "../helpers/tmp-dir"

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

describe("E2E 14.4: chat.params across model families", () => {
  // -------------------------------------------------------------------------
  // Claude family (anthropic provider)
  // -------------------------------------------------------------------------
  describe("Claude (anthropic)", () => {
    it("applies adaptive thinking for bytes agent with reasoning support", async () => {
      const tmp = makeTmpDir("oc-bb-params-claude-")
      writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
      const hooks = await loadPlugin({
        configDir: tmp.path,
        directory: tmp.path,
        worktree: tmp.path,
      })

      const output = await callChatParams(hooks, {
        agent: "bytes",
        model: {
          providerID: "anthropic",
          id: "claude-opus-4-7",
          capabilities: { reasoning: true },
        },
      })

      await tmp.cleanup()
      // Claude with reasoning=true → thinking should be set
      expect(output.options.thinking).toBeDefined()
      const thinking = output.options.thinking as Record<string, unknown>
      // claude-opus-4-7 should use adaptive thinking
      expect(thinking.type).toBe("adaptive")
      // No reasoningEffort for Claude
      expect(output.options.reasoningEffort).toBeUndefined()
    })

    it("sets enabled thinking for older claude models (sonnet-4-5)", async () => {
      const tmp = makeTmpDir("oc-bb-params-claude-old-")
      writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
      const hooks = await loadPlugin({
        configDir: tmp.path,
        directory: tmp.path,
        worktree: tmp.path,
      })

      const output = await callChatParams(hooks, {
        agent: "oracle",
        model: {
          providerID: "anthropic",
          id: "claude-sonnet-4-5",
          capabilities: { reasoning: true },
        },
      })

      await tmp.cleanup()
      const thinking = output.options.thinking as Record<string, unknown>
      expect(thinking).toBeDefined()
      expect(thinking.type).toBe("enabled")
      expect(thinking.budgetTokens).toBeDefined()
    })

    it("does not apply thinking when reasoning=false", async () => {
      const tmp = makeTmpDir("oc-bb-params-claude-nothink-")
      writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
      const hooks = await loadPlugin({
        configDir: tmp.path,
        directory: tmp.path,
        worktree: tmp.path,
      })

      const output = await callChatParams(hooks, {
        agent: "bytes",
        model: {
          providerID: "anthropic",
          id: "claude-opus-4-7",
          capabilities: { reasoning: false },
        },
      })

      await tmp.cleanup()
      expect(output.options.thinking).toBeUndefined()
    })
  })

  // -------------------------------------------------------------------------
  // OpenAI family
  // -------------------------------------------------------------------------
  describe("OpenAI (gpt/o-series)", () => {
    it("applies medium reasoningEffort for bytes agent with reasoning support", async () => {
      const tmp = makeTmpDir("oc-bb-params-oai-bytes-")
      writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
      const hooks = await loadPlugin({
        configDir: tmp.path,
        directory: tmp.path,
        worktree: tmp.path,
      })

      const output = await callChatParams(hooks, {
        agent: "bytes",
        model: { providerID: "openai", id: "gpt-5", capabilities: { reasoning: true } },
      })

      await tmp.cleanup()
      expect(output.options.reasoningEffort).toBe("medium")
      expect(output.options.thinking).toBeUndefined()
    })

    it("applies high reasoningEffort for oracle agent", async () => {
      const tmp = makeTmpDir("oc-bb-params-oai-oracle-")
      writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
      const hooks = await loadPlugin({
        configDir: tmp.path,
        directory: tmp.path,
        worktree: tmp.path,
      })

      const output = await callChatParams(hooks, {
        agent: "oracle",
        model: { providerID: "openai", id: "o3", capabilities: { reasoning: true } },
      })

      await tmp.cleanup()
      expect(output.options.reasoningEffort).toBe("high")
    })

    it("applies medium reasoningEffort for general agent", async () => {
      const tmp = makeTmpDir("oc-bb-params-oai-general-")
      writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
      const hooks = await loadPlugin({
        configDir: tmp.path,
        directory: tmp.path,
        worktree: tmp.path,
      })

      const output = await callChatParams(hooks, {
        agent: "general",
        model: { providerID: "openai", id: "gpt-5", capabilities: { reasoning: true } },
      })

      await tmp.cleanup()
      expect(output.options.reasoningEffort).toBe("medium")
    })

    it("does not apply reasoningEffort when reasoning=false", async () => {
      const tmp = makeTmpDir("oc-bb-params-oai-noreason-")
      writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
      const hooks = await loadPlugin({
        configDir: tmp.path,
        directory: tmp.path,
        worktree: tmp.path,
      })

      const output = await callChatParams(hooks, {
        agent: "bytes",
        model: { providerID: "openai", id: "gpt-4o", capabilities: { reasoning: false } },
      })

      await tmp.cleanup()
      expect(output.options.reasoningEffort).toBeUndefined()
    })
  })

  // -------------------------------------------------------------------------
  // Gemini family
  // -------------------------------------------------------------------------
  describe("Gemini (google)", () => {
    it("applies no thinking and no reasoningEffort", async () => {
      const tmp = makeTmpDir("oc-bb-params-gemini-")
      writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
      const hooks = await loadPlugin({
        configDir: tmp.path,
        directory: tmp.path,
        worktree: tmp.path,
      })

      const output = await callChatParams(hooks, {
        agent: "bytes",
        model: {
          providerID: "google",
          id: "gemini-2.5-pro",
          capabilities: { reasoning: true },
        },
      })

      await tmp.cleanup()
      expect(output.options.thinking).toBeUndefined()
      expect(output.options.reasoningEffort).toBeUndefined()
    })
  })

  // -------------------------------------------------------------------------
  // Unknown family — via github-copilot proxy with unknown model
  // -------------------------------------------------------------------------
  describe("Unknown model family", () => {
    it("applies no thinking and no reasoningEffort for unknown model", async () => {
      const tmp = makeTmpDir("oc-bb-params-unknown-")
      writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
      const hooks = await loadPlugin({
        configDir: tmp.path,
        directory: tmp.path,
        worktree: tmp.path,
      })

      const output = await callChatParams(hooks, {
        agent: "bytes",
        model: {
          providerID: "github-copilot",
          id: "my-unknown-model",
          capabilities: { reasoning: false },
        },
      })

      await tmp.cleanup()
      expect(output.options.thinking).toBeUndefined()
      expect(output.options.reasoningEffort).toBeUndefined()
    })

    it("always strips textVerbosity regardless of model family", async () => {
      const tmp = makeTmpDir("oc-bb-params-textvb-")
      writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
      const hooks = await loadPlugin({
        configDir: tmp.path,
        directory: tmp.path,
        worktree: tmp.path,
      })

      const fn = (hooks as Record<string, unknown>)["chat.params"] as (
        input: ChatParamsInput,
        output: Record<string, unknown>,
      ) => Promise<void>
      const output: Record<string, unknown> = { options: { textVerbosity: "verbose" } }
      await fn({ agent: "bytes", model: { providerID: "openai", id: "gpt-4o" } }, output)

      await tmp.cleanup()
      const opts = output.options as Record<string, unknown>
      expect(opts.textVerbosity).toBeUndefined()
    })
  })

  // -------------------------------------------------------------------------
  // Cross-model via github-copilot proxy (pattern matching)
  // -------------------------------------------------------------------------
  describe("github-copilot proxy with claude model ref", () => {
    it("detects claude family via pattern and applies thinking for bytes", async () => {
      const tmp = makeTmpDir("oc-bb-params-copilot-claude-")
      writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
      const hooks = await loadPlugin({
        configDir: tmp.path,
        directory: tmp.path,
        worktree: tmp.path,
      })

      const output = await callChatParams(hooks, {
        agent: "bytes",
        model: {
          providerID: "github-copilot",
          id: "claude-sonnet-4.6",
          capabilities: { reasoning: true },
        },
      })

      await tmp.cleanup()
      expect(output.options.thinking).toBeDefined()
      const thinking = output.options.thinking as Record<string, unknown>
      expect(["adaptive", "enabled"]).toContain(thinking.type)
    })
  })
})
