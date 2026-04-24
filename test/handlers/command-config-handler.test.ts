/**
 * Tests for src/handlers/config-handler/command-config-handler.ts
 *
 * - No user commands → output contains built-in commands with their exact definitions.
 * - User supplies an additional command (distinct name) → user command plus built-ins present; built-ins unchanged.
 * - User supplies a command with the SAME name as a built-in → user-wins (confirmed from source).
 *   Source comment: "User-defined commands take precedence — never overwrite"
 * - disabled_commands: NOT tested — the current config schema does NOT expose this field.
 *   (Confirmed: the schema and handler have no disabled_commands support.)
 */
import { describe, expect, it } from "bun:test"
import { createBuiltinCommands } from "../../src/extensions/commands"
import { setupModels } from "../../src/extensions/commands/setup-models"
import { handleCommandConfig } from "../../src/handlers/config-handler/command-config-handler"
import type { ConfigContext } from "../../src/handlers/config-handler/types"

// ---------------------------------------------------------------------------
// Helper: build a minimal ConfigContext
// ---------------------------------------------------------------------------
function makeCtx(commandOverrides: Record<string, unknown> = {}): ConfigContext {
  return {
    config: {
      command:
        Object.keys(commandOverrides).length > 0
          ? (commandOverrides as Record<string, unknown>)
          : undefined,
    },
    pluginConfig: {},
    availableModels: new Map(),
  } as unknown as ConfigContext
}

// ---------------------------------------------------------------------------
// Scenario 1: No user commands → built-in commands present with exact definitions
// ---------------------------------------------------------------------------
describe("handleCommandConfig — no user commands", () => {
  it("initializes command map and registers built-in commands", () => {
    const ctx = makeCtx()
    handleCommandConfig(ctx)

    expect(ctx.config.command).toBeDefined()
    expect(ctx.config.command?.["setup-models"]).toBeDefined()
    expect(ctx.config.command?.["setup-lsp"]).toBeUndefined()
  })

  it("setup-models matches the exported setupModels definition verbatim", () => {
    const ctx = makeCtx()
    handleCommandConfig(ctx)

    const registered = ctx.config.command?.["setup-models"]
    expect(registered).toEqual(setupModels)
  })

  it("setup-models has the expected description string", () => {
    const ctx = makeCtx()
    handleCommandConfig(ctx)

    const cmd = ctx.config.command?.["setup-models"] as typeof setupModels
    expect(cmd.description).toBe(
      "Set up optimal model assignments for each agent based on available providers",
    )
  })

  it("setup-models has agent='bytes'", () => {
    const ctx = makeCtx()
    handleCommandConfig(ctx)

    const cmd = ctx.config.command?.["setup-models"] as typeof setupModels
    expect(cmd.agent).toBe("bytes")
  })

  it("setup-models has a non-empty template string", () => {
    const ctx = makeCtx()
    handleCommandConfig(ctx)

    const cmd = ctx.config.command?.["setup-models"] as typeof setupModels
    expect(typeof cmd.template).toBe("string")
    expect(cmd.template.length).toBeGreaterThan(0)
  })
})

describe("createBuiltinCommands", () => {
  it("contains only setup-models", () => {
    const commands = createBuiltinCommands()

    expect(commands["setup-models"]).toEqual(setupModels)
    expect(commands["setup-lsp"]).toBeUndefined()
    expect(Object.keys(commands)).toEqual(["setup-models"])
  })
})

// ---------------------------------------------------------------------------
// Scenario 2: User supplies an additional command (distinct name)
// ---------------------------------------------------------------------------
describe("handleCommandConfig — user command with distinct name", () => {
  it("registers both the user command and the built-ins", () => {
    const userCmd = {
      description: "My custom command",
      template: "do something",
    }

    const ctx = makeCtx({ "my-custom": userCmd })
    handleCommandConfig(ctx)

    // User command preserved
    expect(ctx.config.command?.["my-custom"]).toEqual(userCmd)

    // Built-in also present
    expect(ctx.config.command?.["setup-models"]).toBeDefined()
    expect(ctx.config.command?.["setup-models"]).toEqual(setupModels)
    expect(ctx.config.command?.["setup-lsp"]).toBeUndefined()
  })

  it("built-in setup-models is unchanged when user adds a distinct command", () => {
    const ctx = makeCtx({ "other-command": { description: "other", template: "t" } })
    handleCommandConfig(ctx)

    expect(ctx.config.command?.["setup-models"]).toEqual(setupModels)
    expect(ctx.config.command?.["setup-lsp"]).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Scenario 3: User supplies a command with the SAME name as a built-in
// Precedence: user-wins — source comment confirms "never overwrite" for existing keys.
// ---------------------------------------------------------------------------
describe("handleCommandConfig — user command overrides built-in (user-wins)", () => {
  it("preserves user definition when user provides 'setup-models'", () => {
    const userOverride = {
      description: "My override for setup-models",
      template: "custom template here",
      agent: "oracle",
    }

    const ctx = makeCtx({ "setup-models": userOverride })
    handleCommandConfig(ctx)

    // User-wins: the user override must survive unchanged
    expect(ctx.config.command?.["setup-models"]).toEqual(userOverride)
  })

  it("does NOT overwrite a user-defined command even if it has the same name as a built-in", () => {
    const userDef = { description: "user-defined", template: "user template" }
    const ctx = makeCtx({ "setup-models": userDef })
    handleCommandConfig(ctx)

    // The built-in description should NOT appear
    const registered = ctx.config.command?.["setup-models"] as { description: string }
    expect(registered.description).toBe("user-defined")
    expect(registered.description).not.toBe(setupModels.description)
  })

  it("preserves user-defined 'setup-lsp' because it is no longer built in", () => {
    const userOverride = {
      description: "My custom setup-lsp command",
      template: "custom lsp setup template",
      agent: "oracle",
    }

    const ctx = makeCtx({ "setup-lsp": userOverride })
    handleCommandConfig(ctx)

    expect(ctx.config.command?.["setup-lsp"]).toEqual(userOverride)
    expect(ctx.config.command?.["setup-models"]).toEqual(setupModels)
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe("handleCommandConfig — edge cases", () => {
  it("works correctly when config.command is already an empty object", () => {
    const ctx = makeCtx({}) // passes empty object — handler should not re-init
    // Manually set command to {} to simulate pre-initialized map
    ctx.config.command = {}
    handleCommandConfig(ctx)

    expect(ctx.config.command?.["setup-models"]).toBeDefined()
    expect(ctx.config.command?.["setup-lsp"]).toBeUndefined()
  })

  it("only registers built-in commands with no extra keys from handler", () => {
    const ctx = makeCtx()
    handleCommandConfig(ctx)

    const keys = Object.keys(ctx.config.command ?? {})
    expect(keys).toContain("setup-models")
    expect(keys).not.toContain("setup-lsp")
    expect(keys).toHaveLength(1)
  })
})
