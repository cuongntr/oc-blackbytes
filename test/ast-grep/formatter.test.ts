import { describe, expect, it } from "bun:test"
import {
  formatAnalyzeResult,
  formatReplaceResult,
  formatSearchResult,
} from "../../src/extensions/tools/ast-grep/result-formatter"
import { createSgResultFromStdout } from "../../src/extensions/tools/ast-grep/sg-compact-json-output"
import type { AnalyzeResult, CliMatch, SgResult } from "../../src/extensions/tools/ast-grep/types"

/**
 * Tests for result-formatter.ts and sg-compact-json-output.ts
 *
 * Branches covered:
 * - createSgResultFromStdout: empty input, single match, multi-file matches, truncation
 * - formatSearchResult: no matches, error, single match, multiple matches, truncated
 * - formatReplaceResult: no matches, error, single match, dry-run flag, live-run
 * - formatAnalyzeResult: empty, single match without metavars, single match with metavars
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCliMatch(overrides: Partial<CliMatch> = {}): CliMatch {
  return {
    text: "console.log(foo)",
    range: {
      byteOffset: { start: 0, end: 16 },
      start: { line: 0, column: 0 },
      end: { line: 0, column: 16 },
    },
    file: "src/foo.ts",
    lines: "console.log(foo)",
    charCount: { leading: 0, trailing: 0 },
    language: "typescript",
    ...overrides,
  }
}

function makeAnalyzeResult(overrides: Partial<AnalyzeResult> = {}): AnalyzeResult {
  return {
    text: "console.log(foo)",
    range: {
      start: { line: 0, column: 0 },
      end: { line: 0, column: 16 },
    },
    kind: "call_expression",
    metaVariables: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// createSgResultFromStdout
// ---------------------------------------------------------------------------

describe("createSgResultFromStdout", () => {
  it("returns empty result for empty string", () => {
    const result = createSgResultFromStdout("")
    expect(result.matches).toHaveLength(0)
    expect(result.totalMatches).toBe(0)
    expect(result.truncated).toBe(false)
  })

  it("returns empty result for whitespace-only input", () => {
    const result = createSgResultFromStdout("   \n  ")
    expect(result.matches).toHaveLength(0)
    expect(result.totalMatches).toBe(0)
    expect(result.truncated).toBe(false)
  })

  it("parses a single match from valid JSON", () => {
    const match = makeCliMatch()
    const stdout = JSON.stringify([match])

    const result = createSgResultFromStdout(stdout)
    expect(result.matches).toHaveLength(1)
    expect(result.totalMatches).toBe(1)
    expect(result.truncated).toBe(false)
    expect(result.matches[0].file).toBe("src/foo.ts")
  })

  it("parses multi-file matches from valid JSON", () => {
    const matches = [
      makeCliMatch({ file: "src/a.ts" }),
      makeCliMatch({ file: "src/b.ts" }),
      makeCliMatch({ file: "src/c.ts" }),
    ]
    const stdout = JSON.stringify(matches)

    const result = createSgResultFromStdout(stdout)
    expect(result.matches).toHaveLength(3)
    expect(result.totalMatches).toBe(3)
    expect(result.truncated).toBe(false)
    expect(result.matches.map((m) => m.file)).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"])
  })

  it("truncates matches beyond DEFAULT_MAX_MATCHES (500) and sets truncatedReason", () => {
    // Build 501 matches
    const matches = Array.from({ length: 501 }, (_, i) => makeCliMatch({ file: `src/file${i}.ts` }))
    const stdout = JSON.stringify(matches)

    const result = createSgResultFromStdout(stdout)
    expect(result.matches).toHaveLength(500)
    expect(result.totalMatches).toBe(501)
    expect(result.truncated).toBe(true)
    expect(result.truncatedReason).toBe("max_matches")
  })

  it("returns empty non-truncated result for invalid JSON (non-truncated input)", () => {
    const result = createSgResultFromStdout("not-valid-json")
    expect(result.matches).toHaveLength(0)
    expect(result.truncated).toBe(false)
    expect(result.error).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// formatSearchResult
// ---------------------------------------------------------------------------

describe("formatSearchResult", () => {
  it("returns 'No matches found' for zero matches", () => {
    const result: SgResult = { matches: [], totalMatches: 0, truncated: false }
    expect(formatSearchResult(result)).toBe("No matches found")
  })

  it("returns error message when result has an error", () => {
    const result: SgResult = {
      matches: [],
      totalMatches: 0,
      truncated: false,
      error: "sg binary not found",
    }
    expect(formatSearchResult(result)).toBe("Error: sg binary not found")
  })

  it("formats a single match with file location and lines", () => {
    const match = makeCliMatch({ file: "src/foo.ts", lines: "console.log(foo)" })
    const result: SgResult = { matches: [match], totalMatches: 1, truncated: false }
    const output = formatSearchResult(result)

    // Starts with count summary
    expect(output).toContain("Found 1 match(es)")
    // File location: line+1 and column+1 (0-indexed → 1-indexed)
    expect(output).toContain("src/foo.ts:1:1")
    // Content
    expect(output).toContain("console.log(foo)")
  })

  it("formats multiple matches across different files", () => {
    const matches = [
      makeCliMatch({
        file: "a.ts",
        range: {
          byteOffset: { start: 0, end: 5 },
          start: { line: 0, column: 0 },
          end: { line: 0, column: 5 },
        },
        lines: "foo()",
      }),
      makeCliMatch({
        file: "b.ts",
        range: {
          byteOffset: { start: 0, end: 5 },
          start: { line: 9, column: 3 },
          end: { line: 9, column: 8 },
        },
        lines: "bar()",
      }),
    ]
    const result: SgResult = { matches, totalMatches: 2, truncated: false }
    const output = formatSearchResult(result)

    expect(output).toContain("Found 2 match(es)")
    expect(output).toContain("a.ts:1:1")
    expect(output).toContain("b.ts:10:4")
  })

  it("includes TRUNCATED header and count when result is truncated", () => {
    const match = makeCliMatch()
    const result: SgResult = {
      matches: [match],
      totalMatches: 600,
      truncated: true,
      truncatedReason: "max_matches",
    }
    const output = formatSearchResult(result)

    expect(output).toContain("[TRUNCATED]")
    expect(output).toContain("600")
    expect(output).toContain("Found 1 match(es) (truncated from 600)")
  })

  it("shows timeout reason in truncated header", () => {
    const result: SgResult = {
      matches: [makeCliMatch()],
      totalMatches: 1,
      truncated: true,
      truncatedReason: "timeout",
    }
    const output = formatSearchResult(result)
    expect(output).toContain("search timed out")
  })

  it("shows max_output_bytes reason in truncated header", () => {
    const result: SgResult = {
      matches: [makeCliMatch()],
      totalMatches: 1,
      truncated: true,
      truncatedReason: "max_output_bytes",
    }
    const output = formatSearchResult(result)
    expect(output).toContain("1MB")
  })
})

// ---------------------------------------------------------------------------
// formatReplaceResult
// ---------------------------------------------------------------------------

describe("formatReplaceResult", () => {
  it("returns 'No matches found to replace' for zero matches", () => {
    const result: SgResult = { matches: [], totalMatches: 0, truncated: false }
    expect(formatReplaceResult(result, false)).toBe("No matches found to replace")
  })

  it("returns error message when result has an error", () => {
    const result: SgResult = {
      matches: [],
      totalMatches: 0,
      truncated: false,
      error: "pattern error",
    }
    expect(formatReplaceResult(result, false)).toBe("Error: pattern error")
  })

  it("formats a single replacement with [DRY RUN] prefix when isDryRun=true", () => {
    const match = makeCliMatch({ text: "logger.info(foo)", file: "src/x.ts" })
    const result: SgResult = { matches: [match], totalMatches: 1, truncated: false }
    const output = formatReplaceResult(result, true)

    expect(output).toContain("[DRY RUN]")
    expect(output).toContain("1 replacement(s)")
    expect(output).toContain("src/x.ts:1:1")
    expect(output).toContain("Use dryRun=false to apply changes")
  })

  it("formats replacement without [DRY RUN] prefix when isDryRun=false", () => {
    const match = makeCliMatch({ text: "logger.info(foo)", file: "src/x.ts" })
    const result: SgResult = { matches: [match], totalMatches: 1, truncated: false }
    const output = formatReplaceResult(result, false)

    expect(output).not.toContain("[DRY RUN]")
    expect(output).toContain("1 replacement(s)")
    expect(output).not.toContain("Use dryRun=false to apply changes")
  })

  it("includes TRUNCATED header when result is truncated", () => {
    const result: SgResult = {
      matches: [makeCliMatch()],
      totalMatches: 700,
      truncated: true,
      truncatedReason: "max_matches",
    }
    const output = formatReplaceResult(result, false)
    expect(output).toContain("[TRUNCATED]")
  })
})

// ---------------------------------------------------------------------------
// formatAnalyzeResult
// ---------------------------------------------------------------------------

describe("formatAnalyzeResult", () => {
  it("returns 'No matches found' for empty results array", () => {
    expect(formatAnalyzeResult([], false)).toBe("No matches found")
  })

  it("formats a single match without metavariables", () => {
    const result = makeAnalyzeResult({ kind: "call_expression", text: "foo()" })
    const output = formatAnalyzeResult([result], false)

    expect(output).toContain("Found 1 match(es)")
    expect(output).toContain("L1:1") // line 0 → L1, col 0 → :1
    expect(output).toContain("call_expression")
    expect(output).toContain("foo()")
    expect(output).not.toContain("Meta-variables")
  })

  it("includes meta-variables section when extractedMetaVars=true and metaVariables present", () => {
    const result = makeAnalyzeResult({
      text: "console.log(foo)",
      metaVariables: [{ name: "MSG", text: "foo", kind: "identifier" }],
    })
    const output = formatAnalyzeResult([result], true)

    expect(output).toContain("Meta-variables:")
    expect(output).toContain('$MSG = "foo" (identifier)')
  })

  it("does NOT include meta-variables when extractedMetaVars=false even if present", () => {
    const result = makeAnalyzeResult({
      text: "console.log(foo)",
      metaVariables: [{ name: "MSG", text: "foo", kind: "identifier" }],
    })
    const output = formatAnalyzeResult([result], false)

    expect(output).not.toContain("Meta-variables:")
    expect(output).not.toContain("$MSG")
  })

  it("formats multiple matches with correct location offsets", () => {
    const results = [
      makeAnalyzeResult({
        text: "foo()",
        range: { start: { line: 0, column: 0 }, end: { line: 0, column: 5 } },
        kind: "call",
      }),
      makeAnalyzeResult({
        text: "bar()",
        range: { start: { line: 9, column: 4 }, end: { line: 9, column: 9 } },
        kind: "call",
      }),
    ]

    const output = formatAnalyzeResult(results, false)
    expect(output).toContain("Found 2 match(es)")
    expect(output).toContain("L1:1")
    expect(output).toContain("L10:5")
  })
})
