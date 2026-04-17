/**
 * Tests for edit-ordering.ts
 *
 * The invariant from AGENTS.md: "system applies [edits] bottom-up automatically"
 * meaning edits are sorted by descending line number so that applying each edit
 * doesn't shift the line numbers of subsequent edits.
 */
import { describe, expect, it } from "bun:test"

import {
  collectLineRefs,
  detectOverlappingRanges,
  getEditLineNumber,
} from "../../src/extensions/tools/hashline-edit/edit-ordering"
import type { HashlineEdit } from "../../src/extensions/tools/hashline-edit/types"

describe("getEditLineNumber", () => {
  it("replace with pos only — returns pos line number", () => {
    const edit: HashlineEdit = { op: "replace", pos: "5#ZP", lines: "new" }
    expect(getEditLineNumber(edit)).toBe(5)
  })

  it("replace with end — returns end line number (bottom-up anchor)", () => {
    const edit: HashlineEdit = { op: "replace", pos: "3#ZP", end: "7#MQ", lines: "new" }
    expect(getEditLineNumber(edit)).toBe(7)
  })

  it("append with pos — returns pos line number", () => {
    const edit: HashlineEdit = { op: "append", pos: "10#ZP", lines: "new line" }
    expect(getEditLineNumber(edit)).toBe(10)
  })

  it("append without pos (EOF) — returns NEGATIVE_INFINITY", () => {
    const edit: HashlineEdit = { op: "append", lines: "new line" }
    expect(getEditLineNumber(edit)).toBe(Number.NEGATIVE_INFINITY)
  })

  it("prepend with pos — returns pos line number", () => {
    const edit: HashlineEdit = { op: "prepend", pos: "3#ZP", lines: "new line" }
    expect(getEditLineNumber(edit)).toBe(3)
  })

  it("prepend without pos (BOF) — returns NEGATIVE_INFINITY", () => {
    const edit: HashlineEdit = { op: "prepend", lines: "new line" }
    expect(getEditLineNumber(edit)).toBe(Number.NEGATIVE_INFINITY)
  })
})

describe("collectLineRefs", () => {
  it("collects pos ref from replace with no end", () => {
    const edits: HashlineEdit[] = [{ op: "replace", pos: "5#ZP", lines: "x" }]
    expect(collectLineRefs(edits)).toEqual(["5#ZP"])
  })

  it("collects both pos and end from replace with end", () => {
    const edits: HashlineEdit[] = [{ op: "replace", pos: "3#ZP", end: "7#MQ", lines: "x" }]
    expect(collectLineRefs(edits)).toEqual(["3#ZP", "7#MQ"])
  })

  it("collects pos from append with pos", () => {
    const edits: HashlineEdit[] = [{ op: "append", pos: "10#ZP", lines: "x" }]
    expect(collectLineRefs(edits)).toEqual(["10#ZP"])
  })

  it("returns empty for append without pos", () => {
    const edits: HashlineEdit[] = [{ op: "append", lines: "x" }]
    expect(collectLineRefs(edits)).toEqual([])
  })

  it("collects refs from multiple edits", () => {
    const edits: HashlineEdit[] = [
      { op: "replace", pos: "1#ZP", end: "3#MQ", lines: "x" },
      { op: "append", pos: "5#VR", lines: "y" },
    ]
    expect(collectLineRefs(edits)).toEqual(["1#ZP", "3#MQ", "5#VR"])
  })
})

describe("detectOverlappingRanges", () => {
  it("returns null when no range edits", () => {
    const edits: HashlineEdit[] = [
      { op: "replace", pos: "1#ZP", lines: "x" }, // single line, no end
    ]
    expect(detectOverlappingRanges(edits)).toBeNull()
  })

  it("returns null when single range edit", () => {
    const edits: HashlineEdit[] = [{ op: "replace", pos: "1#ZP", end: "3#MQ", lines: "x" }]
    expect(detectOverlappingRanges(edits)).toBeNull()
  })

  it("returns null when ranges are non-overlapping", () => {
    const edits: HashlineEdit[] = [
      { op: "replace", pos: "1#ZP", end: "3#MQ", lines: "x" },
      { op: "replace", pos: "5#VR", end: "7#WS", lines: "y" },
    ]
    expect(detectOverlappingRanges(edits)).toBeNull()
  })

  it("returns error string when ranges overlap", () => {
    const edits: HashlineEdit[] = [
      { op: "replace", pos: "1#ZP", end: "5#MQ", lines: "x" },
      { op: "replace", pos: "4#VR", end: "8#WS", lines: "y" },
    ]
    const result = detectOverlappingRanges(edits)
    expect(result).not.toBeNull()
    expect(result).toContain("Overlapping range edits")
  })

  it("bottom-up invariant: sorting by descending getEditLineNumber produces correct order", () => {
    // The invariant from AGENTS.md: edits must be applied bottom-up
    // so that earlier edits don't shift line numbers of later edits.
    const edits: HashlineEdit[] = [
      { op: "replace", pos: "1#ZP", lines: "first edit" },
      { op: "replace", pos: "5#MQ", lines: "second edit" },
      { op: "replace", pos: "10#VR", lines: "third edit" },
    ]
    const sorted = [...edits].sort((a, b) => getEditLineNumber(b) - getEditLineNumber(a))
    expect(getEditLineNumber(sorted[0])).toBe(10)
    expect(getEditLineNumber(sorted[1])).toBe(5)
    expect(getEditLineNumber(sorted[2])).toBe(1)
  })

  it("stable sort — edits at identical positions maintain relative order", () => {
    const edits: HashlineEdit[] = [
      { op: "append", pos: "5#ZP", lines: "first append" },
      { op: "append", pos: "5#ZP", lines: "second append" },
    ]
    // Both have line 5 — stable sort preserves original order
    const sorted = [...edits].sort((a, b) => getEditLineNumber(b) - getEditLineNumber(a))
    expect(sorted[0].lines as string).toBe("first append")
    expect(sorted[1].lines as string).toBe("second append")
  })
})
