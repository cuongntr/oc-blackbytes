import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"
import { buildTree, loadPlugin, makeTmpDir, writeFixture, writeJsoncFixture } from "./helpers"

describe("makeTmpDir", () => {
  it("creates a temp dir and cleans up idempotently", async () => {
    const { path: dir, cleanup } = makeTmpDir("oc-bb-helpers-")

    buildTree(dir, { "a.txt": "x", "sub/b.txt": "y" })

    expect(readFileSync(path.join(dir, "a.txt"), "utf-8")).toBe("x")
    expect(readFileSync(path.join(dir, "sub/b.txt"), "utf-8")).toBe("y")

    await cleanup()
    await cleanup() // second call must not throw
  })
})

describe("writeFixture", () => {
  it("writes a file with nested dirs", async () => {
    const { path: dir, cleanup } = makeTmpDir("oc-bb-helpers-")

    writeFixture(path.join(dir, "nested/deep/file.txt"), "hello")
    expect(readFileSync(path.join(dir, "nested/deep/file.txt"), "utf-8")).toBe("hello")

    await cleanup()
  })
})

describe("writeJsoncFixture", () => {
  it("serializes objects as pretty JSON with trailing newline", async () => {
    const { path: dir, cleanup } = makeTmpDir("oc-bb-helpers-")
    const filePath = path.join(dir, "config.json")

    writeJsoncFixture(filePath, { key: "value", num: 42 })
    const content = readFileSync(filePath, "utf-8")
    expect(content).toBe(`${JSON.stringify({ key: "value", num: 42 }, null, 2)}\n`)

    await cleanup()
  })

  it("writes string values verbatim (supports JSONC with comments)", async () => {
    const { path: dir, cleanup } = makeTmpDir("oc-bb-helpers-")
    const filePath = path.join(dir, "config.jsonc")
    const raw = `{\n  // a comment\n  "key": "value"\n}\n`

    writeJsoncFixture(filePath, raw)
    expect(readFileSync(filePath, "utf-8")).toBe(raw)

    await cleanup()
  })
})

describe("plugin-harness", () => {
  it("loadPlugin returns an object with config, chat.headers, tool, and tool.execute.after hooks", async () => {
    const { path: dir, cleanup } = makeTmpDir("oc-bb-harness-")

    writeJsoncFixture(path.join(dir, "oc-blackbytes.json"), {})

    const hooks = await loadPlugin({ configDir: dir, directory: dir, worktree: dir })

    expect(typeof hooks.config).toBe("function")
    expect(typeof hooks["chat.headers"]).toBe("function")
    expect(typeof hooks.tool).toBe("object")
    expect(typeof hooks["tool.execute.after"]).toBe("function")

    await cleanup()
  })
})
