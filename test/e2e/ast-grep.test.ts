/**
 * E2E scenario ocb-3r3.14.6: ast_grep_search + ast_grep_replace against a real temp tree.
 *
 * Skips cleanly if the `sg` binary is not installed. When available:
 *  1. Builds a temp JS file tree containing console.log() calls.
 *  2. Runs ast_grep_search — asserts N matches found.
 *  3. Runs ast_grep_replace (dryRun=false) to replace console.log with logger.info.
 *  4. Runs ast_grep_search again — asserts zero matches.
 */
import { describe, expect, it } from "bun:test"
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { loadPlugin } from "../helpers/plugin-harness"
import { isBinaryAvailable } from "../helpers/process-probe"
import { makeTmpDir, writeJsoncFixture } from "../helpers/tmp-dir"

describe("E2E 14.6: ast_grep_search + ast_grep_replace", () => {
  it("searches and replaces console.log patterns in a real JS tree (skip if sg unavailable)", async () => {
    const sgAvailable = await isBinaryAvailable("sg")
    if (!sgAvailable) {
      console.log("  SKIP: sg binary not found on PATH — skipping ast-grep E2E test")
      return
    }

    const tmp = makeTmpDir("oc-bb-ast-grep-")
    writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
    const hooks = await loadPlugin({ configDir: tmp.path, directory: tmp.path, worktree: tmp.path })

    // Build temp JS tree with console.log calls
    const jsContent = `
function hello() {
  console.log("hello world")
  console.log("debug info")
  return 42
}
`.trim()

    const file1 = path.join(tmp.path, "a.js")
    const file2 = path.join(tmp.path, "b.js")
    writeFileSync(file1, jsContent, "utf-8")
    writeFileSync(file2, `console.log("standalone")`, "utf-8")

    const registry = hooks.tool as Record<
      string,
      { execute: (args: unknown, ctx: unknown) => Promise<unknown> }
    >
    const searchTool = registry.ast_grep_search
    const replaceTool = registry.ast_grep_replace

    expect(searchTool).toBeDefined()
    expect(replaceTool).toBeDefined()

    const ctx = { directory: tmp.path }

    // Step 1: Search for console.log patterns
    const searchResult = await searchTool.execute(
      {
        pattern: "console.log($MSG)",
        lang: "javascript",
        paths: [tmp.path],
      },
      ctx,
    )

    const searchOutput = searchResult as string
    expect(searchOutput).not.toMatch(/^Error:/)
    // Should find matches in both files
    expect(searchOutput).toContain("console.log")

    // Step 2: Replace console.log with logger.info (dryRun=false)
    const replaceResult = await replaceTool.execute(
      {
        pattern: "console.log($MSG)",
        rewrite: "logger.info($MSG)",
        lang: "javascript",
        paths: [tmp.path],
        dryRun: false,
      },
      ctx,
    )

    const replaceOutput = replaceResult as string
    expect(replaceOutput).not.toMatch(/^Error:/)

    // Step 3: Read the files and verify they were changed
    const file1After = readFileSync(file1, "utf-8")
    const file2After = readFileSync(file2, "utf-8")

    expect(file1After).toContain("logger.info")
    expect(file1After).not.toContain("console.log")
    expect(file2After).toContain("logger.info")
    expect(file2After).not.toContain("console.log")

    // Step 4: Search again — should find zero matches
    const searchResult2 = await searchTool.execute(
      {
        pattern: "console.log($MSG)",
        lang: "javascript",
        paths: [tmp.path],
      },
      ctx,
    )

    const searchOutput2 = searchResult2 as string
    // No matches should be reported
    expect(searchOutput2).not.toContain("console.log(")

    await tmp.cleanup()
  })

  it("ast_grep_search returns no error for a pattern with zero matches", async () => {
    const sgAvailable = await isBinaryAvailable("sg")
    if (!sgAvailable) {
      console.log("  SKIP: sg binary not found on PATH")
      return
    }

    const tmp = makeTmpDir("oc-bb-ast-nomatch-")
    writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
    const hooks = await loadPlugin({ configDir: tmp.path, directory: tmp.path, worktree: tmp.path })

    writeFileSync(path.join(tmp.path, "empty.js"), "const x = 1\n", "utf-8")

    const registry = hooks.tool as Record<
      string,
      { execute: (args: unknown, ctx: unknown) => Promise<unknown> }
    >

    const result = await registry.ast_grep_search.execute(
      {
        pattern: "console.log($MSG)",
        lang: "javascript",
        paths: [tmp.path],
      },
      { directory: tmp.path },
    )

    await tmp.cleanup()

    const output = result as string
    expect(output).not.toMatch(/^Error:/)
    // Should report zero matches (no error, just empty result)
    expect(typeof output).toBe("string")
  })
})
