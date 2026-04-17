import { describe, expect, it } from "bun:test"
import { mkdirSync, utimesSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { runRgFiles } from "../../src/extensions/tools/glob/cli"
import { resolveFindCli } from "../../src/extensions/tools/glob/find-cli"
import { formatGlobResult } from "../../src/extensions/tools/glob/result-formatter"
import { isBinaryAvailable } from "../helpers/process-probe"
import { makeTmpDir } from "../helpers/tmp-dir"

const findAvailable = await isBinaryAvailable("find")
const describeIfFind = findAvailable ? describe : describe.skip

// ---------------------------------------------------------------------------
// resolveFindCli
// ---------------------------------------------------------------------------

describe("resolveFindCli", () => {
  it("resolves to a non-empty string path", async () => {
    const p = await resolveFindCli()
    expect(typeof p).toBe("string")
    expect(p.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// formatGlobResult
// ---------------------------------------------------------------------------

describe("formatGlobResult", () => {
  it("returns 'No files found' for empty result", () => {
    expect(formatGlobResult({ files: [], totalFiles: 0, truncated: false })).toBe("No files found")
  })

  it("returns error string when result has an error", () => {
    const result = formatGlobResult({ files: [], totalFiles: 0, truncated: false, error: "boom" })
    expect(result).toBe("Error: boom")
  })

  it("formats file paths with count header", () => {
    const result = formatGlobResult({
      files: [
        { path: "/a/b/c.ts", mtime: 1 },
        { path: "/a/b/d.ts", mtime: 2 },
      ],
      totalFiles: 2,
      truncated: false,
    })
    expect(result).toContain("Found 2 file(s)")
    expect(result).toContain("/a/b/c.ts")
    expect(result).toContain("/a/b/d.ts")
  })

  it("includes truncation message when truncated=true", () => {
    const result = formatGlobResult({
      files: [{ path: "/a/b.ts", mtime: 0 }],
      totalFiles: 1,
      truncated: true,
    })
    expect(result).toContain("truncated")
  })
})

// ---------------------------------------------------------------------------
// runRgFiles — uses real find binary
// ---------------------------------------------------------------------------

describeIfFind("runRgFiles — real find binary", () => {
  it("finds all JS files in a flat directory", async () => {
    const tmp = makeTmpDir("glob-e2e-flat-")
    try {
      writeFileSync(join(tmp.path, "a.js"), "const a = 1")
      writeFileSync(join(tmp.path, "b.js"), "const b = 2")
      writeFileSync(join(tmp.path, "c.ts"), "const c = 3")

      const result = await runRgFiles({
        pattern: "*.js",
        paths: [tmp.path],
      })

      expect(result.error).toBeUndefined()
      expect(result.totalFiles).toBe(2)
      const paths = result.files.map((f) => f.path)
      expect(paths.some((p) => p.endsWith("a.js"))).toBe(true)
      expect(paths.some((p) => p.endsWith("b.js"))).toBe(true)
      expect(paths.some((p) => p.endsWith("c.ts"))).toBe(false)
    } finally {
      await tmp.cleanup()
    }
  })

  it("finds files in nested directories", async () => {
    const tmp = makeTmpDir("glob-e2e-nested-")
    try {
      const sub = join(tmp.path, "src", "utils")
      mkdirSync(sub, { recursive: true })
      writeFileSync(join(tmp.path, "root.ts"), "")
      writeFileSync(join(sub, "helper.ts"), "")

      const result = await runRgFiles({
        pattern: "*.ts",
        paths: [tmp.path],
      })

      expect(result.error).toBeUndefined()
      const paths = result.files.map((f) => f.path)
      expect(paths.some((p) => p.endsWith("root.ts"))).toBe(true)
      expect(paths.some((p) => p.endsWith("helper.ts"))).toBe(true)
    } finally {
      await tmp.cleanup()
    }
  })

  it("returns files sorted by mtime descending (newest first)", async () => {
    const tmp = makeTmpDir("glob-e2e-mtime-")
    try {
      const oldest = join(tmp.path, "oldest.ts")
      const middle = join(tmp.path, "middle.ts")
      const newest = join(tmp.path, "newest.ts")

      writeFileSync(oldest, "")
      writeFileSync(middle, "")
      writeFileSync(newest, "")

      // Set explicit mtimes: oldest=100s, middle=200s, newest=300s
      const epoch = (secs: number) => new Date(secs * 1000)
      utimesSync(oldest, epoch(100), epoch(100))
      utimesSync(middle, epoch(200), epoch(200))
      utimesSync(newest, epoch(300), epoch(300))

      const result = await runRgFiles({
        pattern: "*.ts",
        paths: [tmp.path],
      })

      expect(result.error).toBeUndefined()
      expect(result.files.length).toBe(3)

      // Sorted by mtime descending — newest first
      const names = result.files.map((f) => f.path.split("/").pop())
      expect(names[0]).toBe("newest.ts")
      expect(names[1]).toBe("middle.ts")
      expect(names[2]).toBe("oldest.ts")
    } finally {
      await tmp.cleanup()
    }
  })

  it("respects the limit of 100 files and sets truncated=true", async () => {
    const tmp = makeTmpDir("glob-e2e-limit-")
    try {
      // Create 105 files
      for (let i = 0; i < 105; i++) {
        writeFileSync(join(tmp.path, `file${i.toString().padStart(3, "0")}.ts`), "")
      }

      const result = await runRgFiles({
        pattern: "*.ts",
        paths: [tmp.path],
        limit: 100,
      })

      expect(result.error).toBeUndefined()
      expect(result.totalFiles).toBeLessThanOrEqual(100)
      expect(result.truncated).toBe(true)
    } finally {
      await tmp.cleanup()
    }
  })

  it("returns empty result when no files match the pattern", async () => {
    const tmp = makeTmpDir("glob-e2e-empty-")
    try {
      writeFileSync(join(tmp.path, "a.js"), "")

      const result = await runRgFiles({
        pattern: "*.ts",
        paths: [tmp.path],
      })

      expect(result.error).toBeUndefined()
      expect(result.files).toHaveLength(0)
      expect(result.totalFiles).toBe(0)
      expect(result.truncated).toBe(false)
    } finally {
      await tmp.cleanup()
    }
  })
})
