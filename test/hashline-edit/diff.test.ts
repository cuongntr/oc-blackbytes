/**
 * Tests for diff-utils.ts and hashline-edit-diff.ts
 *
 * toHashlineContent: annotates content lines with LINE#ID prefixes.
 * generateUnifiedDiff: produces standard unified diff format.
 * countLineDiffs: counts additions and deletions between two content strings.
 * generateHashlineDiff: produces per-line diff with LINE#ID markers.
 */
import { describe, expect, it } from "bun:test"

import {
  countLineDiffs,
  generateUnifiedDiff,
  toHashlineContent,
} from "../../src/extensions/tools/hashline-edit/diff-utils"
import { computeLineHash } from "../../src/extensions/tools/hashline-edit/hash-computation"
import { generateHashlineDiff } from "../../src/extensions/tools/hashline-edit/hashline-edit-diff"

describe("toHashlineContent", () => {
  it("returns empty for empty input", () => {
    expect(toHashlineContent("")).toBe("")
  })

  it("annotates single line (no trailing newline)", () => {
    const result = toHashlineContent("hello")
    expect(result).toMatch(/^1#[ZPMQVRWSNKTXJBYH]{2}\|hello$/)
  })

  it("annotates multiple lines without trailing newline", () => {
    const result = toHashlineContent("foo\nbar\nbaz")
    const lines = result.split("\n")
    expect(lines).toHaveLength(3)
    expect(lines[0]).toMatch(/^1#[ZPMQVRWSNKTXJBYH]{2}\|foo$/)
    expect(lines[1]).toMatch(/^2#[ZPMQVRWSNKTXJBYH]{2}\|bar$/)
    expect(lines[2]).toMatch(/^3#[ZPMQVRWSNKTXJBYH]{2}\|baz$/)
  })

  it("preserves trailing newline", () => {
    const result = toHashlineContent("line1\nline2\n")
    expect(result.endsWith("\n")).toBe(true)
    const nonEmpty = result.split("\n").filter(Boolean)
    expect(nonEmpty).toHaveLength(2)
  })

  it("hash matches computeLineHash", () => {
    const content = "const x = 42"
    const result = toHashlineContent(content)
    const expectedHash = computeLineHash(1, content)
    expect(result).toBe(`1#${expectedHash}|${content}`)
  })
})

describe("generateUnifiedDiff", () => {
  it("returns empty string when content is identical", () => {
    const content = "line1\nline2\nline3\n"
    expect(generateUnifiedDiff(content, content, "file.ts")).toBe("")
  })

  it("returns diff with file headers when content differs", () => {
    const old = "line1\nline2\n"
    const next = "line1\nmodified\n"
    const diff = generateUnifiedDiff(old, next, "test.ts")
    expect(diff).toContain("--- test.ts")
    expect(diff).toContain("+++ test.ts")
  })

  it("contains hunk header @@ for changes", () => {
    const old = "a\nb\nc\n"
    const next = "a\nX\nc\n"
    const diff = generateUnifiedDiff(old, next, "f.ts")
    expect(diff).toContain("@@")
  })

  it("shows deletions with - prefix", () => {
    const old = "keep\nremove\n"
    const next = "keep\n"
    const diff = generateUnifiedDiff(old, next, "f.ts")
    expect(diff).toContain("-remove")
  })

  it("shows insertions with + prefix", () => {
    const old = "keep\n"
    const next = "keep\nnewline\n"
    const diff = generateUnifiedDiff(old, next, "f.ts")
    expect(diff).toContain("+newline")
  })

  it("round-trip concept — diff describes transformation old→new", () => {
    const old = "alpha\nbeta\ngamma\n"
    const next = "alpha\nDELTA\ngamma\n"
    const diff = generateUnifiedDiff(old, next, "file.ts")
    // diff should contain both removed and added lines
    expect(diff).toContain("-beta")
    expect(diff).toContain("+DELTA")
  })
})

describe("countLineDiffs", () => {
  it("identical content — zero diffs", () => {
    const content = "a\nb\nc"
    const { additions, deletions } = countLineDiffs(content, content)
    expect(additions).toBe(0)
    expect(deletions).toBe(0)
  })

  it("one line added", () => {
    const old = "a\nb"
    const next = "a\nb\nc"
    const { additions, deletions } = countLineDiffs(old, next)
    expect(additions).toBeGreaterThan(0)
    expect(deletions).toBe(0)
  })

  it("one line removed", () => {
    const old = "a\nb\nc"
    const next = "a\nb"
    const { additions, deletions } = countLineDiffs(old, next)
    expect(deletions).toBeGreaterThan(0)
    expect(additions).toBe(0)
  })

  it("line changed (one deletion + one addition)", () => {
    const old = "a\nb\nc"
    const next = "a\nX\nc"
    const { additions, deletions } = countLineDiffs(old, next)
    expect(additions).toBeGreaterThan(0)
    expect(deletions).toBeGreaterThan(0)
  })

  it("empty → content: more additions than deletions", () => {
    const { additions, deletions } = countLineDiffs("", "a\nb\nc")
    // "a", "b", "c" are new; the split of "" is [""] which may count as deleted
    expect(additions).toBeGreaterThan(deletions)
  })

  it("content → empty: more deletions than additions", () => {
    const { additions, deletions } = countLineDiffs("a\nb\nc", "")
    // "a", "b", "c" are removed; split of "" is [""] which may count as added
    expect(deletions).toBeGreaterThan(additions)
  })
})

describe("generateHashlineDiff", () => {
  it("produces file header lines", () => {
    const diff = generateHashlineDiff("old\n", "new\n", "file.ts")
    expect(diff).toContain("--- file.ts")
    expect(diff).toContain("+++ file.ts")
  })

  it("no diff lines when content is identical", () => {
    const content = "same content\n"
    const diff = generateHashlineDiff(content, content, "file.ts")
    // Only the header, no +/- lines
    const lines = diff.split("\n").filter((l) => l.startsWith("+ ") || l.startsWith("- "))
    expect(lines).toHaveLength(0)
  })

  it("marks changed line with - (old) and + (new)", () => {
    const old = "line1\nold\nline3\n"
    const next = "line1\nnew\nline3\n"
    const diff = generateHashlineDiff(old, next, "f.ts")
    expect(diff).toContain("-")
    expect(diff).toContain("+")
    const plusLines = diff.split("\n").filter((l) => l.startsWith("+ "))
    expect(plusLines.some((l) => l.includes("new"))).toBe(true)
  })

  it("+ lines include LINE#ID anchor with correct hash", () => {
    const content = "hello world\n"
    const diff = generateHashlineDiff("old content\n", content, "f.ts")
    const hash = computeLineHash(1, "hello world")
    const plusLines = diff.split("\n").filter((l) => l.startsWith("+ "))
    expect(plusLines.some((l) => l.includes(`1#${hash}`))).toBe(true)
  })

  it("added lines (new file longer) marked with +", () => {
    const old = "line1\n"
    const next = "line1\nline2\nline3\n"
    const diff = generateHashlineDiff(old, next, "f.ts")
    const plusLines = diff.split("\n").filter((l) => l.startsWith("+ "))
    expect(plusLines.length).toBeGreaterThanOrEqual(2)
  })

  it("deleted lines (old file longer) marked with -", () => {
    const old = "line1\nline2\nline3\n"
    const next = "line1\n"
    const diff = generateHashlineDiff(old, next, "f.ts")
    const minusLines = diff.split("\n").filter((l) => l.startsWith("- "))
    expect(minusLines.length).toBeGreaterThanOrEqual(2)
  })
})
