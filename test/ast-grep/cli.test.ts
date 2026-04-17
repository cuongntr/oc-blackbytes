import { describe, expect, it } from "bun:test"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { runSg } from "../../src/extensions/tools/ast-grep/cli"
import { isBinaryAvailable } from "../helpers/process-probe"
import { makeTmpDir } from "../helpers/tmp-dir"

const sgAvailable = await isBinaryAvailable("sg")
const describeIfSg = sgAvailable ? describe : describe.skip

// ---------------------------------------------------------------------------
// End-to-end tests using real sg binary
// ---------------------------------------------------------------------------

describeIfSg("runSg — real sg binary", () => {
  it("finds console.log($MSG) pattern in a JS file", async () => {
    const tmp = makeTmpDir("sg-e2e-search-")
    try {
      const srcDir = join(tmp.path, "src")
      mkdirSync(srcDir, { recursive: true })
      writeFileSync(
        join(srcDir, "app.js"),
        `
console.log("hello world")
const x = 1
console.log(x)
`,
      )

      const result = await runSg({
        pattern: "console.log($MSG)",
        lang: "javascript",
        paths: [tmp.path],
      })

      expect(result.error).toBeUndefined()
      expect(result.matches.length).toBeGreaterThanOrEqual(2)
      expect(result.totalMatches).toBeGreaterThanOrEqual(2)
      expect(result.truncated).toBe(false)

      const files = result.matches.map((m) => m.file)
      expect(files.some((f) => f.includes("app.js"))).toBe(true)
    } finally {
      await tmp.cleanup()
    }
  })

  it("returns empty matches when pattern is not found", async () => {
    const tmp = makeTmpDir("sg-e2e-nomatch-")
    try {
      writeFileSync(join(tmp.path, "empty.js"), "const x = 1\n")

      const result = await runSg({
        pattern: "console.log($MSG)",
        lang: "javascript",
        paths: [tmp.path],
      })

      expect(result.error).toBeUndefined()
      expect(result.matches).toHaveLength(0)
      expect(result.totalMatches).toBe(0)
    } finally {
      await tmp.cleanup()
    }
  })

  it("performs dry-run replace (rewrite without updateAll)", async () => {
    const tmp = makeTmpDir("sg-e2e-replace-")
    try {
      const original = `console.log("test")\n`
      const filePath = join(tmp.path, "index.js")
      writeFileSync(filePath, original)

      const result = await runSg({
        pattern: "console.log($MSG)",
        lang: "javascript",
        rewrite: "logger.info($MSG)",
        paths: [tmp.path],
        // updateAll not set → dry-run: matches are found but file not changed
      })

      expect(result.error).toBeUndefined()
      expect(result.matches.length).toBeGreaterThanOrEqual(1)

      // File should remain unchanged in dry-run mode
      const { readFileSync } = await import("node:fs")
      expect(readFileSync(filePath, "utf-8")).toBe(original)
    } finally {
      await tmp.cleanup()
    }
  })

  it("applies in-place replace when updateAll=true", async () => {
    const tmp = makeTmpDir("sg-e2e-update-")
    try {
      const filePath = join(tmp.path, "mod.js")
      writeFileSync(filePath, `console.log("before")\n`)

      const result = await runSg({
        pattern: "console.log($MSG)",
        lang: "javascript",
        rewrite: "logger.info($MSG)",
        paths: [tmp.path],
        updateAll: true,
      })

      expect(result.error).toBeUndefined()
      expect(result.matches.length).toBeGreaterThanOrEqual(1)

      const { readFileSync } = await import("node:fs")
      const updated = readFileSync(filePath, "utf-8")
      expect(updated).toContain("logger.info")
    } finally {
      await tmp.cleanup()
    }
  })
})

// ---------------------------------------------------------------------------
// Graceful degradation when sg is not available
// ---------------------------------------------------------------------------

describe("runSg — missing binary", () => {
  it("returns an error result when sg binary is not found", async () => {
    if (sgAvailable) {
      // sg is installed — skip this specific scenario
      return
    }

    const tmp = makeTmpDir("sg-e2e-missing-")
    try {
      writeFileSync(join(tmp.path, "a.ts"), "console.log(1)\n")
      const result = await runSg({
        pattern: "console.log($MSG)",
        lang: "typescript",
        paths: [tmp.path],
      })

      // Should return an error string, not throw
      expect(result.matches).toHaveLength(0)
      expect(result.error).toBeDefined()
      expect(result.error).toBeDefined()
    } finally {
      await tmp.cleanup()
    }
  })
})
