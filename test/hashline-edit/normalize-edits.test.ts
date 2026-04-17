/**
 * Tests for normalize-edits.ts
 *
 * normalizeHashlineEdits: validates and normalizes raw tool input into typed HashlineEdit[].
 * - Validates op field
 * - Normalizes anchors (trims whitespace, removes empty)
 * - Coerces null lines → [] (delete)
 * - Throws on missing lines or missing anchor for replace
 */
import { describe, expect, it } from "bun:test"

import type { RawHashlineEdit } from "../../src/extensions/tools/hashline-edit/normalize-edits"
import { normalizeHashlineEdits } from "../../src/extensions/tools/hashline-edit/normalize-edits"

describe("normalizeHashlineEdits — replace", () => {
  it("normalizes a basic replace with pos", () => {
    const raw: RawHashlineEdit[] = [{ op: "replace", pos: "1#AB", lines: ["new content"] }]
    const [result] = normalizeHashlineEdits(raw)
    expect(result.op).toBe("replace")
    expect(result.pos).toBe("1#AB")
    expect(result.lines).toEqual(["new content"])
  })

  it("normalizes replace with pos and end", () => {
    const raw: RawHashlineEdit[] = [{ op: "replace", pos: "2#CD", end: "4#EF", lines: ["x"] }]
    const [result] = normalizeHashlineEdits(raw)
    expect(result.op).toBe("replace")
    expect(result.pos).toBe("2#CD")
    if (result.op === "replace") expect(result.end).toBe("4#EF")
  })

  it("replace with only end (no pos) — uses end as anchor", () => {
    const raw: RawHashlineEdit[] = [{ op: "replace", end: "3#GH", lines: ["replaced"] }]
    const [result] = normalizeHashlineEdits(raw)
    expect(result.op).toBe("replace")
    expect(result.pos).toBe("3#GH")
  })

  it("null lines → empty array (delete semantics)", () => {
    const raw: RawHashlineEdit[] = [{ op: "replace", pos: "1#AB", lines: null }]
    const [result] = normalizeHashlineEdits(raw)
    expect(result.lines).toEqual([])
  })

  it("string lines is preserved as-is", () => {
    const raw: RawHashlineEdit[] = [{ op: "replace", pos: "1#AB", lines: "single string" }]
    const [result] = normalizeHashlineEdits(raw)
    expect(result.lines).toBe("single string")
  })

  it("trims whitespace from anchor", () => {
    const raw: RawHashlineEdit[] = [{ op: "replace", pos: "  1#AB  ", lines: ["x"] }]
    const [result] = normalizeHashlineEdits(raw)
    expect(result.pos).toBe("1#AB")
  })

  it("throws when lines is undefined", () => {
    const raw: RawHashlineEdit[] = [{ op: "replace", pos: "1#AB" }]
    expect(() => normalizeHashlineEdits(raw)).toThrow("lines is required")
  })

  it("throws when neither pos nor end is provided", () => {
    const raw: RawHashlineEdit[] = [{ op: "replace", lines: ["x"] }]
    expect(() => normalizeHashlineEdits(raw)).toThrow("requires at least one anchor")
  })

  it("empty pos string is treated as undefined anchor", () => {
    const raw: RawHashlineEdit[] = [{ op: "replace", pos: "   ", lines: ["x"] }]
    // pos becomes undefined, end is also undefined → should throw
    expect(() => normalizeHashlineEdits(raw)).toThrow("requires at least one anchor")
  })
})

describe("normalizeHashlineEdits — append", () => {
  it("normalizes append with pos", () => {
    const raw: RawHashlineEdit[] = [{ op: "append", pos: "5#IJ", lines: ["appended"] }]
    const [result] = normalizeHashlineEdits(raw)
    expect(result.op).toBe("append")
    expect(result.pos).toBe("5#IJ")
    expect(result.lines).toEqual(["appended"])
  })

  it("append without anchor is valid (BOF/EOF insert)", () => {
    const raw: RawHashlineEdit[] = [{ op: "append", lines: ["at end"] }]
    const [result] = normalizeHashlineEdits(raw)
    expect(result.op).toBe("append")
    expect(result.pos).toBeUndefined()
  })

  it("null lines → empty array", () => {
    const raw: RawHashlineEdit[] = [{ op: "append", pos: "1#AB", lines: null }]
    const [result] = normalizeHashlineEdits(raw)
    expect(result.lines).toEqual([])
  })

  it("throws when lines undefined", () => {
    const raw: RawHashlineEdit[] = [{ op: "append", pos: "1#AB" }]
    expect(() => normalizeHashlineEdits(raw)).toThrow("lines is required")
  })
})

describe("normalizeHashlineEdits — prepend", () => {
  it("normalizes prepend with pos", () => {
    const raw: RawHashlineEdit[] = [{ op: "prepend", pos: "1#KL", lines: ["header"] }]
    const [result] = normalizeHashlineEdits(raw)
    expect(result.op).toBe("prepend")
    expect(result.pos).toBe("1#KL")
  })

  it("prepend without anchor is valid", () => {
    const raw: RawHashlineEdit[] = [{ op: "prepend", lines: ["beginning"] }]
    const [result] = normalizeHashlineEdits(raw)
    expect(result.op).toBe("prepend")
    expect(result.pos).toBeUndefined()
  })
})

describe("normalizeHashlineEdits — unsupported op", () => {
  it("throws for unknown op", () => {
    const raw = [{ op: "upsert" as never, pos: "1#AB", lines: ["x"] }]
    expect(() => normalizeHashlineEdits(raw)).toThrow('unsupported op "upsert"')
  })

  it("throws for undefined op", () => {
    const raw: RawHashlineEdit[] = [{ lines: ["x"] }]
    expect(() => normalizeHashlineEdits(raw)).toThrow("unsupported op")
  })
})

describe("normalizeHashlineEdits — multiple edits", () => {
  it("processes multiple edits in order", () => {
    const raw: RawHashlineEdit[] = [
      { op: "replace", pos: "1#AB", lines: ["first"] },
      { op: "append", pos: "3#CD", lines: ["second"] },
      { op: "prepend", pos: "5#EF", lines: ["third"] },
    ]
    const results = normalizeHashlineEdits(raw)
    expect(results).toHaveLength(3)
    expect(results[0].op).toBe("replace")
    expect(results[1].op).toBe("append")
    expect(results[2].op).toBe("prepend")
  })

  it("error message includes edit index", () => {
    const raw: RawHashlineEdit[] = [
      { op: "replace", pos: "1#AB", lines: ["ok"] },
      { op: "replace", pos: "2#CD" }, // missing lines at index 1
    ]
    expect(() => normalizeHashlineEdits(raw)).toThrow("Edit 1:")
  })
})
