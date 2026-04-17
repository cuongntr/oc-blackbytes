/**
 * Tests for edit-operations.ts
 *
 * applyHashlineEdits / applyHashlineEditsWithReport orchestrate:
 * deduplication → sorting (desc line order) → validation → apply ops in sequence.
 *
 * Anchors are generated with formatHashLine from hash-computation so they are real.
 *
 * Test file content used throughout (5 lines):
 *   1#WZ|line one
 *   2#XT|line two
 *   3#VJ|line three
 *   4#ZK|line four
 *   5#JZ|line five
 */
import { describe, expect, it } from "bun:test"

import {
  applyHashlineEdits,
  applyHashlineEditsWithReport,
} from "../../src/extensions/tools/hashline-edit/edit-operations"
import type { HashlineEdit } from "../../src/extensions/tools/hashline-edit/types"

const BASE = "line one\nline two\nline three\nline four\nline five"
// Pre-computed anchors for BASE (verified with formatHashLine)
const A1 = "1#WZ" // line one
const A2 = "2#XT" // line two
const A3 = "3#VJ" // line three
const A4 = "4#ZK" // line four
const A5 = "5#JZ" // line five

describe("applyHashlineEdits", () => {
  describe("empty edits", () => {
    it("returns content unchanged for empty edits array", () => {
      expect(applyHashlineEdits(BASE, [])).toBe(BASE)
    })

    it("returns empty string unchanged", () => {
      expect(applyHashlineEdits("", [])).toBe("")
    })
  })

  describe("replace op — single line", () => {
    it("replaces a single line by pos only", () => {
      const edits: HashlineEdit[] = [{ op: "replace", pos: A2, lines: "replaced" }]
      const result = applyHashlineEdits(BASE, edits)
      expect(result).toBe("line one\nreplaced\nline three\nline four\nline five")
    })

    it("replaces the first line", () => {
      const edits: HashlineEdit[] = [{ op: "replace", pos: A1, lines: "new first" }]
      expect(applyHashlineEdits(BASE, edits)).toBe(
        "new first\nline two\nline three\nline four\nline five",
      )
    })

    it("replaces the last line", () => {
      const edits: HashlineEdit[] = [{ op: "replace", pos: A5, lines: "new last" }]
      expect(applyHashlineEdits(BASE, edits)).toBe(
        "line one\nline two\nline three\nline four\nnew last",
      )
    })
  })

  describe("replace op — range", () => {
    it("replaces a range of lines with a single replacement line", () => {
      const edits: HashlineEdit[] = [{ op: "replace", pos: A2, end: A3, lines: "merged" }]
      const result = applyHashlineEdits(BASE, edits)
      expect(result).toBe("line one\nmerged\nline four\nline five")
    })

    it("replaces a range with multiple lines", () => {
      const edits: HashlineEdit[] = [{ op: "replace", pos: A2, end: A3, lines: ["a", "b", "c"] }]
      const result = applyHashlineEdits(BASE, edits)
      expect(result).toBe("line one\na\nb\nc\nline four\nline five")
    })

    it("deletes a range by replacing with empty lines array", () => {
      const edits: HashlineEdit[] = [{ op: "replace", pos: A2, end: A3, lines: [] }]
      const result = applyHashlineEdits(BASE, edits)
      expect(result).toBe("line one\nline four\nline five")
    })
  })

  describe("append op", () => {
    it("appends after a specific line (pos provided)", () => {
      const edits: HashlineEdit[] = [{ op: "append", pos: A2, lines: "inserted after 2" }]
      const result = applyHashlineEdits(BASE, edits)
      expect(result).toBe("line one\nline two\ninserted after 2\nline three\nline four\nline five")
    })

    it("appends to end of file (no pos)", () => {
      const edits: HashlineEdit[] = [{ op: "append", lines: "appended at end" }]
      const result = applyHashlineEdits(BASE, edits)
      expect(result).toBe("line one\nline two\nline three\nline four\nline five\nappended at end")
    })
  })

  describe("prepend op", () => {
    it("inserts before a specific line (pos provided)", () => {
      const edits: HashlineEdit[] = [{ op: "prepend", pos: A3, lines: "before line three" }]
      const result = applyHashlineEdits(BASE, edits)
      expect(result).toBe("line one\nline two\nbefore line three\nline three\nline four\nline five")
    })

    it("prepends to beginning of file (no pos)", () => {
      const edits: HashlineEdit[] = [{ op: "prepend", lines: "first" }]
      const result = applyHashlineEdits(BASE, edits)
      expect(result).toBe("first\nline one\nline two\nline three\nline four\nline five")
    })
  })

  describe("multiple edits — correct order", () => {
    it("applies two non-overlapping replaces correctly (high-to-low line order)", () => {
      const edits: HashlineEdit[] = [
        { op: "replace", pos: A1, lines: "new one" },
        { op: "replace", pos: A5, lines: "new five" },
      ]
      const result = applyHashlineEdits(BASE, edits)
      expect(result).toBe("new one\nline two\nline three\nline four\nnew five")
    })

    it("applies replace + append to different lines", () => {
      const edits: HashlineEdit[] = [
        { op: "replace", pos: A3, lines: "replaced three" },
        { op: "append", pos: A5, lines: "extra" },
      ]
      const result = applyHashlineEdits(BASE, edits)
      expect(result).toBe("line one\nline two\nreplaced three\nline four\nline five\nextra")
    })
  })
})

describe("applyHashlineEditsWithReport", () => {
  describe("empty edits", () => {
    it("returns zero noopEdits and zero deduplicatedEdits for empty array", () => {
      const report = applyHashlineEditsWithReport(BASE, [])
      expect(report.content).toBe(BASE)
      expect(report.noopEdits).toBe(0)
      expect(report.deduplicatedEdits).toBe(0)
    })
  })

  describe("noop edit detection", () => {
    it("counts a replace that produces identical content as noop", () => {
      // Replacing line 1 with its existing content → noop
      const edits: HashlineEdit[] = [{ op: "replace", pos: A1, lines: "line one" }]
      const report = applyHashlineEditsWithReport(BASE, edits)
      expect(report.noopEdits).toBe(1)
      expect(report.content).toBe(BASE)
    })

    it("does not count a real change as noop", () => {
      const edits: HashlineEdit[] = [{ op: "replace", pos: A1, lines: "different" }]
      const report = applyHashlineEditsWithReport(BASE, edits)
      expect(report.noopEdits).toBe(0)
      expect(report.content).not.toBe(BASE)
    })
  })

  describe("deduplication counting", () => {
    it("deduplicates identical edits and reports count", () => {
      const edit: HashlineEdit = { op: "replace", pos: A2, lines: "deduped" }
      const edits: HashlineEdit[] = [edit, { ...edit }, { ...edit }]
      const report = applyHashlineEditsWithReport(BASE, edits)
      // 3 submitted → 2 deduped, 1 applied
      expect(report.deduplicatedEdits).toBe(2)
      expect(report.content).toBe("line one\ndeduped\nline three\nline four\nline five")
    })

    it("reports 0 deduplicatedEdits when all edits are unique", () => {
      const edits: HashlineEdit[] = [
        { op: "replace", pos: A1, lines: "new one" },
        { op: "replace", pos: A5, lines: "new five" },
      ]
      const report = applyHashlineEditsWithReport(BASE, edits)
      expect(report.deduplicatedEdits).toBe(0)
    })
  })

  describe("overlapping ranges throw", () => {
    it("throws when two replace ranges overlap", () => {
      const edits: HashlineEdit[] = [
        { op: "replace", pos: A1, end: A3, lines: "first block" },
        { op: "replace", pos: A2, end: A4, lines: "overlapping block" },
      ]
      expect(() => applyHashlineEdits(BASE, edits)).toThrow()
    })
  })
})
