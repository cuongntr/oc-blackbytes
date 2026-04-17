import { describe, expect, it } from "bun:test"
import {
  formatCountResult,
  formatGrepResult,
} from "../../src/extensions/tools/grep/result-formatter"
import type { CountResult, GrepMatch, GrepResult } from "../../src/extensions/tools/grep/types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMatch(overrides: Partial<GrepMatch> = {}): GrepMatch {
  return {
    file: "src/foo.ts",
    line: 10,
    text: "  console.log(hello)",
    ...overrides,
  }
}

function makeResult(overrides: Partial<GrepResult> = {}): GrepResult {
  return {
    matches: [],
    totalMatches: 0,
    filesSearched: 0,
    truncated: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// formatGrepResult — content mode (default)
// ---------------------------------------------------------------------------

describe("formatGrepResult — content mode", () => {
  it("returns 'No matches found' when matches is empty", () => {
    expect(formatGrepResult(makeResult())).toBe("No matches found")
  })

  it("returns error string when result has an error", () => {
    const result = makeResult({ error: "rg not found" })
    expect(formatGrepResult(result)).toBe("Error: rg not found")
  })

  it("formats a single match with file, line, and trimmed text", () => {
    const match = makeMatch({ file: "src/a.ts", line: 42, text: "  console.log(x)" })
    const result = makeResult({ matches: [match], totalMatches: 1, filesSearched: 1 })
    const output = formatGrepResult(result)

    expect(output).toContain("Found 1 match(es) in 1 file(s)")
    expect(output).toContain("src/a.ts")
    expect(output).toContain("42: console.log(x)")
  })

  it("groups multiple matches under their respective files", () => {
    const matches: GrepMatch[] = [
      makeMatch({ file: "a.ts", line: 1, text: "foo()" }),
      makeMatch({ file: "b.ts", line: 5, text: "bar()" }),
      makeMatch({ file: "a.ts", line: 20, text: "baz()" }),
    ]
    const result = makeResult({ matches, totalMatches: 3, filesSearched: 2 })
    const output = formatGrepResult(result)

    expect(output).toContain("Found 3 match(es) in 2 file(s)")
    // Both files appear
    expect(output).toContain("a.ts")
    expect(output).toContain("b.ts")
    // All line references appear
    expect(output).toContain("1: foo()")
    expect(output).toContain("5: bar()")
    expect(output).toContain("20: baz()")
  })

  it("includes truncation notice when result.truncated is true", () => {
    const match = makeMatch()
    const result = makeResult({
      matches: [match],
      totalMatches: 1,
      filesSearched: 1,
      truncated: true,
    })
    const output = formatGrepResult(result)
    expect(output).toContain("[Output truncated due to size limit]")
  })
})

// ---------------------------------------------------------------------------
// formatGrepResult — files_with_matches mode
// ---------------------------------------------------------------------------

describe("formatGrepResult — files_with_matches mode", () => {
  it("shows only file paths when all matches have line=0 and empty text", () => {
    // files_with_matches mode: rg outputs one match per file with no text
    const matches: GrepMatch[] = [
      { file: "src/x.ts", line: 0, text: "" },
      { file: "src/y.ts", line: 0, text: "" },
    ]
    const result = makeResult({ matches, totalMatches: 2, filesSearched: 2 })
    const output = formatGrepResult(result)

    expect(output).toContain("Found 2 match(es) in 2 file(s)")
    expect(output).toContain("src/x.ts")
    expect(output).toContain("src/y.ts")
    // Should NOT include line numbers in files-only mode
    expect(output).not.toMatch(/\d+: /)
  })
})

// ---------------------------------------------------------------------------
// formatCountResult — count mode
// ---------------------------------------------------------------------------

describe("formatCountResult", () => {
  it("returns 'No matches found' for empty array", () => {
    expect(formatCountResult([])).toBe("No matches found")
  })

  it("formats counts sorted descending by count", () => {
    const results: CountResult[] = [
      { file: "low.ts", count: 1 },
      { file: "high.ts", count: 10 },
      { file: "mid.ts", count: 5 },
    ]
    const output = formatCountResult(results)

    expect(output).toContain("Found 16 match(es) in 3 file(s)")
    // high.ts should appear before mid.ts before low.ts
    const highIdx = output.indexOf("high.ts")
    const midIdx = output.indexOf("mid.ts")
    const lowIdx = output.indexOf("low.ts")
    expect(highIdx).toBeLessThan(midIdx)
    expect(midIdx).toBeLessThan(lowIdx)
  })

  it("pads counts with leading spaces for alignment", () => {
    const results: CountResult[] = [{ file: "a.ts", count: 42 }]
    const output = formatCountResult(results)
    // count is padStart(6), so "    42"
    expect(output).toContain("    42: a.ts")
  })
})
