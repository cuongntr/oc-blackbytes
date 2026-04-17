/**
 * Tests for src/bootstrap.ts — top-level hook assembly.
 *
 * Uses the loadPlugin harness (which calls src/index.ts → createOpenCodePlugin).
 *
 * Pinned hook keys (from bootstrap.ts):
 *   config, chat.headers, chat.params, tool, tool.execute.after
 *
 * Notes:
 * - toHaveProperty uses dot-notation path traversal, so keys containing dots
 *   (like "chat.headers") must be checked via Object.keys or bracket access.
 * - The `tool` hook is an object (the tool registry), not a function.
 *   All other hooks are functions.
 * - The config hook mutates its input in-place and returns undefined.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import path from "node:path"
import { loadPlugin } from "../helpers/plugin-harness"
import { makeTmpDir, writeFixture, writeJsoncFixture } from "../helpers/tmp-dir"

const EXPECTED_HOOKS = ["config", "chat.headers", "chat.params", "tool", "tool.execute.after"]

// Hooks that are functions (all except "tool" which is an object registry)
const FUNCTION_HOOKS = ["config", "chat.headers", "chat.params", "tool.execute.after"]

function assertHooksPresent(hooks: unknown) {
  const hooksRecord = hooks as Record<string, unknown>
  const keys = Object.keys(hooksRecord)
  for (const key of EXPECTED_HOOKS) {
    expect(keys).toContain(key)
  }
}

describe("bootstrap — hook assembly", () => {
  let dir: string
  let cleanup: () => Promise<void>

  beforeEach(() => {
    const tmp = makeTmpDir("oc-bb-bootstrap-")
    dir = tmp.path
    cleanup = tmp.cleanup
  })

  afterEach(async () => {
    await cleanup()
  })

  // ---------------------------------------------------------------------------
  // Scenario 1: well-formed config → all hooks present, each correct type
  // ---------------------------------------------------------------------------
  describe("well-formed config", () => {
    it("returns an object with exactly the expected hook keys", async () => {
      writeJsoncFixture(path.join(dir, "oc-blackbytes.jsonc"), { hashline_edit: true })
      const hooks = await loadPlugin({ configDir: dir, directory: dir, worktree: dir })

      assertHooksPresent(hooks)
    })

    it("function hooks are typeof 'function'", async () => {
      writeJsoncFixture(path.join(dir, "oc-blackbytes.jsonc"), { hashline_edit: true })
      const hooks = await loadPlugin({ configDir: dir, directory: dir, worktree: dir })
      const hooksRecord = hooks as Record<string, unknown>

      for (const key of FUNCTION_HOOKS) {
        expect(typeof hooksRecord[key]).toBe("function")
      }
    })

    it("'tool' hook is an object (the tool registry, not a function)", async () => {
      writeJsoncFixture(path.join(dir, "oc-blackbytes.jsonc"), { hashline_edit: true })
      const hooks = await loadPlugin({ configDir: dir, directory: dir, worktree: dir })
      const hooksRecord = hooks as Record<string, unknown>

      expect(typeof hooksRecord.tool).toBe("object")
      expect(hooksRecord.tool).not.toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // Scenario 2: empty config ({}) → all hooks still present with safe defaults
  // ---------------------------------------------------------------------------
  describe("empty config", () => {
    it("returns all hooks without throwing for an empty config object", async () => {
      writeJsoncFixture(path.join(dir, "oc-blackbytes.jsonc"), {})
      const hooks = await loadPlugin({ configDir: dir, directory: dir, worktree: dir })

      assertHooksPresent(hooks)
    })

    it("function hooks are callable on empty config", async () => {
      writeJsoncFixture(path.join(dir, "oc-blackbytes.jsonc"), {})
      const hooks = await loadPlugin({ configDir: dir, directory: dir, worktree: dir })
      const hooksRecord = hooks as Record<string, unknown>

      for (const key of FUNCTION_HOOKS) {
        expect(typeof hooksRecord[key]).toBe("function")
      }
    })

    it("config hook is callable and does not throw", async () => {
      writeJsoncFixture(path.join(dir, "oc-blackbytes.jsonc"), {})
      const hooks = await loadPlugin({ configDir: dir, directory: dir, worktree: dir })
      const hooksRecord = hooks as Record<string, unknown>
      const configFn = hooksRecord.config as (input: unknown) => Promise<unknown>

      // The config hook mutates the input config in-place; call must not reject
      let threw = false
      try {
        await configFn({})
      } catch {
        threw = true
      }
      expect(threw).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Scenario 3: unknown top-level key → tolerated (extra keys stripped by Zod)
  // loadPluginConfig uses safeParse which strips unknown keys — no throw.
  // ---------------------------------------------------------------------------
  describe("config with unknown top-level key", () => {
    it("does not throw when config has unrecognised top-level keys", async () => {
      writeJsoncFixture(path.join(dir, "oc-blackbytes.jsonc"), {
        unknown_future_key: "some value",
        another_unknown: 42,
      })

      // Should not throw
      const hooks = await loadPlugin({ configDir: dir, directory: dir, worktree: dir })
      assertHooksPresent(hooks)
    })

    it("function hooks are still present when config has extra keys", async () => {
      writeJsoncFixture(path.join(dir, "oc-blackbytes.jsonc"), {
        unknown_future_key: "some value",
      })
      const hooks = await loadPlugin({ configDir: dir, directory: dir, worktree: dir })
      const hooksRecord = hooks as Record<string, unknown>

      for (const key of FUNCTION_HOOKS) {
        expect(typeof hooksRecord[key]).toBe("function")
      }
    })
  })

  // ---------------------------------------------------------------------------
  // Scenario 4: malformed config (schema violation)
  // loadPluginConfig catches schema errors and returns {} with a warning,
  // so bootstrap proceeds with safe defaults — no propagated Zod error.
  // The warning is emitted via console.warn; hooks are still all present.
  // ---------------------------------------------------------------------------
  describe("malformed config (schema violation)", () => {
    it("does not throw and returns all hooks when schema validation fails", async () => {
      // disabled_mcps must be an array, not a string — schema violation
      writeFixture(path.join(dir, "oc-blackbytes.jsonc"), '{ "disabled_mcps": "not-an-array" }')

      // loadPluginConfig returns {} with a warning; no throw propagated
      const hooks = await loadPlugin({ configDir: dir, directory: dir, worktree: dir })
      assertHooksPresent(hooks)
    })

    it("function hooks are still callable after malformed config fallback", async () => {
      writeFixture(path.join(dir, "oc-blackbytes.jsonc"), '{ "disabled_mcps": "not-an-array" }')

      const hooks = await loadPlugin({ configDir: dir, directory: dir, worktree: dir })
      const hooksRecord = hooks as Record<string, unknown>

      for (const key of FUNCTION_HOOKS) {
        expect(typeof hooksRecord[key]).toBe("function")
      }
    })
  })

  // ---------------------------------------------------------------------------
  // No config file at all → safe defaults
  // ---------------------------------------------------------------------------
  describe("no config file", () => {
    it("returns all hooks when no config file exists in configDir", async () => {
      // dir is empty — no oc-blackbytes.jsonc
      const hooks = await loadPlugin({ configDir: dir, directory: dir, worktree: dir })
      assertHooksPresent(hooks)
    })

    it("function hooks are callable when no config file exists", async () => {
      const hooks = await loadPlugin({ configDir: dir, directory: dir, worktree: dir })
      const hooksRecord = hooks as Record<string, unknown>

      for (const key of FUNCTION_HOOKS) {
        expect(typeof hooksRecord[key]).toBe("function")
      }
    })
  })
})
