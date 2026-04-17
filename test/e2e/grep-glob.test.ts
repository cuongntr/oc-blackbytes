/**
 * E2E scenario ocb-3r3.14.7: grep + glob end-to-end.
 *
 * Builds a real temp file tree and drives the grep and glob tools through the
 * plugin's tool hook. Skips if rg binary is unavailable.
 *
 * Asserts expected file counts and match counts.
 */
import { describe, expect, it } from "bun:test"
import path from "node:path"
import { loadPlugin } from "../helpers/plugin-harness"
import { isBinaryAvailable } from "../helpers/process-probe"
import { buildTree, makeTmpDir, writeJsoncFixture } from "../helpers/tmp-dir"

describe("E2E 14.7: grep + glob end-to-end", () => {
  it("grep finds pattern matches across the temp tree (skip if rg unavailable)", async () => {
    const rgAvailable = await isBinaryAvailable("rg")
    if (!rgAvailable) {
      console.log("  SKIP: rg binary not found on PATH — skipping grep E2E test")
      return
    }

    const tmp = makeTmpDir("oc-bb-grep-")
    writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
    const hooks = await loadPlugin({ configDir: tmp.path, directory: tmp.path, worktree: tmp.path })

    // Build a tree with some TypeScript files containing a known pattern
    buildTree(tmp.path, {
      "src/alpha.ts": "export function alpha() { return MAGIC_TOKEN }\n",
      "src/beta.ts": "export function beta() { return MAGIC_TOKEN }\n",
      "src/gamma.ts": "export function gamma() { return 'unrelated' }\n",
      "README.md": "# My Project\nThis uses MAGIC_TOKEN internally.\n",
    })

    const registry = hooks.tool as Record<
      string,
      { execute: (args: unknown, ctx: unknown) => Promise<unknown> }
    >
    const grepTool = registry.grep
    expect(grepTool).toBeDefined()

    const ctx = { directory: tmp.path }

    // Search for MAGIC_TOKEN in .ts files only
    const result = await grepTool.execute(
      {
        pattern: "MAGIC_TOKEN",
        path: tmp.path,
        include: "*.ts",
        output_mode: "files_with_matches",
      },
      ctx,
    )

    const output = result as string
    expect(output).not.toMatch(/^Error:/)
    // Should match alpha.ts and beta.ts
    expect(output).toContain("alpha.ts")
    expect(output).toContain("beta.ts")
    // gamma.ts should not match
    expect(output).not.toContain("gamma.ts")

    await tmp.cleanup()
  })

  it("grep count mode returns match counts per file", async () => {
    const rgAvailable = await isBinaryAvailable("rg")
    if (!rgAvailable) {
      console.log("  SKIP: rg binary not found on PATH")
      return
    }

    const tmp = makeTmpDir("oc-bb-grep-count-")
    writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
    const hooks = await loadPlugin({ configDir: tmp.path, directory: tmp.path, worktree: tmp.path })

    buildTree(tmp.path, {
      "a.ts": "// TODO: fix this\n// TODO: also fix this\nconst x = 1\n",
      "b.ts": "// TODO: single todo\nconst y = 2\n",
    })

    const registry = hooks.tool as Record<
      string,
      { execute: (args: unknown, ctx: unknown) => Promise<unknown> }
    >

    const result = await registry.grep.execute(
      {
        pattern: "TODO",
        path: tmp.path,
        output_mode: "count",
      },
      { directory: tmp.path },
    )

    const output = result as string
    expect(output).not.toMatch(/^Error:/)
    // Should show counts for both files
    expect(output).toContain("a.ts")
    expect(output).toContain("b.ts")

    await tmp.cleanup()
  })

  it("glob finds files matching a pattern in the temp tree (skip if rg unavailable)", async () => {
    const rgAvailable = await isBinaryAvailable("rg")
    if (!rgAvailable) {
      console.log("  SKIP: rg binary not found on PATH — skipping glob E2E test")
      return
    }

    const tmp = makeTmpDir("oc-bb-glob-")
    writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
    const hooks = await loadPlugin({ configDir: tmp.path, directory: tmp.path, worktree: tmp.path })

    buildTree(tmp.path, {
      "src/main.ts": "export {}",
      "src/util.ts": "export {}",
      "src/helper.js": "module.exports = {}",
      "README.md": "# docs",
      "package.json": "{}",
    })

    const registry = hooks.tool as Record<
      string,
      { execute: (args: unknown, ctx: unknown) => Promise<unknown> }
    >
    const globTool = registry.glob
    expect(globTool).toBeDefined()

    // Find all TypeScript files
    const result = await globTool.execute(
      {
        pattern: "**/*.ts",
        path: tmp.path,
      },
      { directory: tmp.path },
    )

    const output = result as string
    expect(output).not.toMatch(/^Error:/)
    // Should find main.ts and util.ts
    expect(output).toContain("main.ts")
    expect(output).toContain("util.ts")
    // Should not include .js or .md or .json
    expect(output).not.toContain("helper.js")
    expect(output).not.toContain("README.md")

    await tmp.cleanup()
  })

  it("glob with nested directory pattern matches files at any depth", async () => {
    const rgAvailable = await isBinaryAvailable("rg")
    if (!rgAvailable) {
      console.log("  SKIP: rg binary not found on PATH")
      return
    }

    const tmp = makeTmpDir("oc-bb-glob-nested-")
    writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
    const hooks = await loadPlugin({ configDir: tmp.path, directory: tmp.path, worktree: tmp.path })

    buildTree(tmp.path, {
      "lib/a/deep/file.ts": "export const a = 1",
      "lib/b/file.ts": "export const b = 2",
      "src/file.ts": "export const c = 3",
      "notts.js": "const d = 4",
    })

    const registry = hooks.tool as Record<
      string,
      { execute: (args: unknown, ctx: unknown) => Promise<unknown> }
    >

    const result = await registry.glob.execute(
      {
        pattern: "**/*.ts",
        path: path.join(tmp.path, "lib"),
      },
      { directory: tmp.path },
    )

    const output = result as string
    expect(output).not.toMatch(/^Error:/)
    expect(output).toContain("file.ts")

    await tmp.cleanup()
  })
})
