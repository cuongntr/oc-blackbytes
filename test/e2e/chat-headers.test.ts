/**
 * E2E scenario ocb-3r3.14.3: chat.headers for Copilot vs other providers.
 *
 * Drives the chat.headers hook with synthetic provider inputs for:
 *   github-copilot, github-copilot-enterprise, openai, anthropic, custom
 *
 * Asserts x-initiator:agent is injected only for the two Copilot variants
 * (when not using the official @ai-sdk/github-copilot npm package).
 */
import { describe, expect, it } from "bun:test"
import { loadPlugin } from "../helpers/plugin-harness"
import { makeTmpDir, writeJsoncFixture } from "../helpers/tmp-dir"

interface ChatHeadersInput {
  model: {
    providerID: string
    id: string
    api?: { npm?: string }
  }
}

interface ChatHeadersOutput {
  headers: Record<string, string>
}

async function callChatHeaders(
  hooks: Awaited<ReturnType<typeof loadPlugin>>,
  input: ChatHeadersInput,
): Promise<ChatHeadersOutput> {
  const fn = (hooks as Record<string, unknown>)["chat.headers"] as (
    input: ChatHeadersInput,
    output: ChatHeadersOutput,
  ) => Promise<void>
  const output: ChatHeadersOutput = { headers: {} }
  await fn(input, output)
  return output
}

describe("E2E 14.3: chat.headers — Copilot vs other providers", () => {
  it("injects x-initiator:agent for github-copilot (no special npm)", async () => {
    const tmp = makeTmpDir("oc-bb-chat-headers-")
    writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
    const hooks = await loadPlugin({ configDir: tmp.path, directory: tmp.path, worktree: tmp.path })

    const output = await callChatHeaders(hooks, {
      model: { providerID: "github-copilot", id: "claude-sonnet-4.6" },
    })

    await tmp.cleanup()
    expect(output.headers["x-initiator"]).toBe("agent")
  })

  it("injects x-initiator:agent for github-copilot-enterprise", async () => {
    const tmp = makeTmpDir("oc-bb-chat-headers-ent-")
    writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
    const hooks = await loadPlugin({ configDir: tmp.path, directory: tmp.path, worktree: tmp.path })

    const output = await callChatHeaders(hooks, {
      model: { providerID: "github-copilot-enterprise", id: "gpt-4o" },
    })

    await tmp.cleanup()
    expect(output.headers["x-initiator"]).toBe("agent")
  })

  it("does NOT inject x-initiator for github-copilot with @ai-sdk/github-copilot npm", async () => {
    const tmp = makeTmpDir("oc-bb-chat-headers-sdk-")
    writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
    const hooks = await loadPlugin({ configDir: tmp.path, directory: tmp.path, worktree: tmp.path })

    const output = await callChatHeaders(hooks, {
      model: {
        providerID: "github-copilot",
        id: "claude-sonnet-4.6",
        api: { npm: "@ai-sdk/github-copilot" },
      },
    })

    await tmp.cleanup()
    expect(output.headers["x-initiator"]).toBeUndefined()
  })

  it("does NOT inject x-initiator for openai provider", async () => {
    const tmp = makeTmpDir("oc-bb-chat-headers-oai-")
    writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
    const hooks = await loadPlugin({ configDir: tmp.path, directory: tmp.path, worktree: tmp.path })

    const output = await callChatHeaders(hooks, {
      model: { providerID: "openai", id: "gpt-4o" },
    })

    await tmp.cleanup()
    expect(output.headers["x-initiator"]).toBeUndefined()
  })

  it("does NOT inject x-initiator for anthropic provider", async () => {
    const tmp = makeTmpDir("oc-bb-chat-headers-anthropic-")
    writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
    const hooks = await loadPlugin({ configDir: tmp.path, directory: tmp.path, worktree: tmp.path })

    const output = await callChatHeaders(hooks, {
      model: { providerID: "anthropic", id: "claude-opus-4-7" },
    })

    await tmp.cleanup()
    expect(output.headers["x-initiator"]).toBeUndefined()
  })

  it("does NOT inject x-initiator for a custom/unknown provider", async () => {
    const tmp = makeTmpDir("oc-bb-chat-headers-custom-")
    writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
    const hooks = await loadPlugin({ configDir: tmp.path, directory: tmp.path, worktree: tmp.path })

    const output = await callChatHeaders(hooks, {
      model: { providerID: "my-custom-provider", id: "custom-model" },
    })

    await tmp.cleanup()
    expect(output.headers["x-initiator"]).toBeUndefined()
  })
})
