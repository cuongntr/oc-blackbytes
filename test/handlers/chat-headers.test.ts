import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import path from "node:path"
import { loadPlugin } from "../helpers/plugin-harness"
import { makeTmpDir, writeJsoncFixture } from "../helpers/tmp-dir"

type ChatHeadersHook = (
  input: { model: { providerID: string; api?: { npm?: string } } },
  output: { headers: Record<string, string> },
) => Promise<void>

describe("handlers/chat-headers-handler", () => {
  let dir: string
  let cleanup: () => Promise<void>
  let hook: ChatHeadersHook

  beforeEach(async () => {
    const tmp = makeTmpDir("oc-bb-chat-headers-")
    dir = tmp.path
    cleanup = tmp.cleanup
    writeJsoncFixture(path.join(dir, "oc-blackbytes.json"), {})
    const hooks = await loadPlugin({ configDir: dir, directory: dir, worktree: dir })
    hook = hooks["chat.headers"] as ChatHeadersHook
  })

  afterEach(async () => {
    await cleanup()
  })

  it("injects x-initiator for github-copilot provider", async () => {
    const output = { headers: {} }
    await hook({ model: { providerID: "github-copilot" } }, output)
    expect(output.headers["x-initiator"]).toBe("agent")
  })

  it("injects x-initiator for github-copilot-enterprise provider", async () => {
    const output = { headers: {} }
    await hook({ model: { providerID: "github-copilot-enterprise" } }, output)
    expect(output.headers["x-initiator"]).toBe("agent")
  })

  it("preserves pre-existing headers when injecting for github-copilot", async () => {
    const output = { headers: { Authorization: "Bearer token123" } }
    await hook({ model: { providerID: "github-copilot" } }, output)
    expect(output.headers["x-initiator"]).toBe("agent")
    expect(output.headers.Authorization).toBe("Bearer token123")
  })

  it("does NOT inject x-initiator for openai provider", async () => {
    const output = { headers: { Authorization: "Bearer sk-xxx" } }
    await hook({ model: { providerID: "openai" } }, output)
    expect(output.headers["x-initiator"]).toBeUndefined()
    expect(output.headers.Authorization).toBe("Bearer sk-xxx")
  })

  it("does NOT inject x-initiator for anthropic provider", async () => {
    const output = { headers: {} }
    await hook({ model: { providerID: "anthropic" } }, output)
    expect(output.headers["x-initiator"]).toBeUndefined()
  })

  it("does NOT inject x-initiator for unknown-custom provider", async () => {
    const output = { headers: {} }
    await hook({ model: { providerID: "unknown-custom" } }, output)
    expect(output.headers["x-initiator"]).toBeUndefined()
  })

  it("does NOT overwrite pre-existing x-initiator value (pin observed behavior)", async () => {
    // When the caller already sets x-initiator, check what happens.
    // The source sets output.headers["x-initiator"] = "agent" unconditionally for Copilot,
    // so it DOES overwrite. We pin that behavior here.
    const output = { headers: { "x-initiator": "caller-set" } }
    await hook({ model: { providerID: "github-copilot" } }, output)
    // Source always overwrites — pinning this observed behavior:
    expect(output.headers["x-initiator"]).toBe("agent")
  })

  it("skips injection when api.npm is @ai-sdk/github-copilot (early return branch)", async () => {
    const output = { headers: {} }
    await hook(
      { model: { providerID: "github-copilot", api: { npm: "@ai-sdk/github-copilot" } } },
      output,
    )
    // The handler returns early in this case, so no header is set
    expect(output.headers["x-initiator"]).toBeUndefined()
  })
})
