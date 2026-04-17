import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import path from "node:path"
import { loadPlugin } from "../helpers/plugin-harness"
import { makeTmpDir, writeJsoncFixture } from "../helpers/tmp-dir"

const ALL_TOOLS = ["hashline_edit", "ast_grep_search", "ast_grep_replace", "grep", "glob"]

describe("handlers/tool-handler", () => {
  let dir: string
  let cleanup: () => Promise<void>

  beforeEach(() => {
    const tmp = makeTmpDir("oc-bb-tool-handler-")
    dir = tmp.path
    cleanup = tmp.cleanup
  })

  afterEach(async () => {
    await cleanup()
  })

  async function loadTools(config: Record<string, unknown>): Promise<Record<string, unknown>> {
    writeJsoncFixture(path.join(dir, "oc-blackbytes.json"), config)
    const hooks = await loadPlugin({ configDir: dir, directory: dir, worktree: dir })
    return (hooks.tool ?? {}) as Record<string, unknown>
  }

  it("registers all 5 tools by default (empty config)", async () => {
    const tools = await loadTools({})
    const names = Object.keys(tools).sort()
    expect(names).toEqual([...ALL_TOOLS].sort())
  })

  it("omits hashline_edit when hashline_edit: false in config", async () => {
    const tools = await loadTools({ hashline_edit: false })
    expect(tools.hashline_edit).toBeUndefined()
    // Other tools still present
    expect(tools.ast_grep_search).toBeDefined()
    expect(tools.grep).toBeDefined()
    expect(tools.glob).toBeDefined()
  })

  it("omits a tool listed in disabled_tools", async () => {
    const tools = await loadTools({ disabled_tools: ["grep"] })
    expect(tools.grep).toBeUndefined()
    expect(tools.hashline_edit).toBeDefined()
    expect(tools.glob).toBeDefined()
  })

  it("disabled_tools is case-insensitive", async () => {
    const tools = await loadTools({ disabled_tools: ["GLOB"] })
    expect(tools.glob).toBeUndefined()
  })

  it("can disable multiple tools via disabled_tools", async () => {
    const tools = await loadTools({ disabled_tools: ["grep", "glob", "ast_grep_search"] })
    expect(tools.grep).toBeUndefined()
    expect(tools.glob).toBeUndefined()
    expect(tools.ast_grep_search).toBeUndefined()
    expect(tools.hashline_edit).toBeDefined()
    expect(tools.ast_grep_replace).toBeDefined()
    expect(Object.keys(tools).length).toBe(2)
  })

  it("disabling all tools results in empty registry", async () => {
    const tools = await loadTools({ disabled_tools: ALL_TOOLS, hashline_edit: false })
    expect(Object.keys(tools).length).toBe(0)
  })

  it("hashline_edit: false + disabled_tools together both respected", async () => {
    const tools = await loadTools({ hashline_edit: false, disabled_tools: ["grep"] })
    expect(tools.hashline_edit).toBeUndefined()
    expect(tools.grep).toBeUndefined()
    expect(tools.ast_grep_search).toBeDefined()
    expect(tools.ast_grep_replace).toBeDefined()
    expect(tools.glob).toBeDefined()
    expect(Object.keys(tools).length).toBe(3)
  })
})
