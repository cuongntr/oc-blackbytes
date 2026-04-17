import { describe, expect, it } from "bun:test"

import {
  applyAppend,
  applyInsertAfter,
  applyInsertBefore,
  applyPrepend,
  applyReplaceLines,
  applySetLine,
} from "../../src/extensions/tools/hashline-edit/edit-operation-primitives"

// All anchored tests use { skipValidation: true } to bypass hash validation
// and focus on testing the operation logic itself.

const SKIP = { skipValidation: true }

const SAMPLE = [
  "function hello() {",
  '  console.log("hi");',
  '  console.log("bye");',
  "}",
  "",
  "function world() {",
]

describe("applySetLine — single-line replace", () => {
  it("replaces a single line at the given position", () => {
    const result = applySetLine([...SAMPLE], "2#XX", '  console.log("hello");', SKIP)
    expect(result[1]).toBe('  console.log("hello");')
    expect(result).toHaveLength(SAMPLE.length)
  })

  it("preserves all other lines", () => {
    const result = applySetLine([...SAMPLE], "1#XX", "function renamed() {", SKIP)
    expect(result[0]).toBe("function renamed() {")
    expect(result.slice(1)).toEqual(SAMPLE.slice(1))
  })

  it("can replace the last line", () => {
    const lines = ["a", "b", "c"]
    const result = applySetLine(lines, "3#XX", "C", SKIP)
    expect(result).toEqual(["a", "b", "C"])
  })

  it("can expand single line into multiple lines", () => {
    const lines = ["const x = 1"]
    // Autocorrect won't expand here — just pass two lines as string[]
    const result = applySetLine(lines, "1#XX", ["const x = 1", "const y = 2"], SKIP)
    expect(result).toHaveLength(2)
    expect(result[0]).toBe("const x = 1")
    expect(result[1]).toBe("const y = 2")
  })
})

describe("applyReplaceLines — range replace", () => {
  it("replaces a range of lines", () => {
    const lines = ["a", "b", "c", "d", "e"]
    const result = applyReplaceLines(lines, "2#XX", "4#XX", ["B", "C", "D"], SKIP)
    expect(result).toEqual(["a", "B", "C", "D", "e"])
  })

  it("can shrink a range to fewer lines", () => {
    const lines = ["a", "b", "c", "d", "e"]
    const result = applyReplaceLines(lines, "2#XX", "4#XX", ["SINGLE"], SKIP)
    expect(result).toEqual(["a", "SINGLE", "e"])
  })

  it("can expand a range to more lines", () => {
    const lines = ["a", "b", "e"]
    const result = applyReplaceLines(lines, "2#XX", "2#XX", ["b", "c", "d"], SKIP)
    expect(result).toEqual(["a", "b", "c", "d", "e"])
  })

  it("delete — empty array removes the lines", () => {
    const lines = ["a", "b", "c"]
    const result = applyReplaceLines(lines, "2#XX", "2#XX", [], SKIP)
    expect(result).toEqual(["a", "c"])
  })

  it("delete multi-line range", () => {
    const lines = ["a", "b", "c", "d", "e"]
    const result = applyReplaceLines(lines, "2#XX", "4#XX", [], SKIP)
    expect(result).toEqual(["a", "e"])
  })

  it("throws when start > end", () => {
    const lines = ["a", "b", "c"]
    expect(() => applyReplaceLines(lines, "3#XX", "1#XX", ["x"], SKIP)).toThrow()
  })
})

describe("applyInsertAfter — append with anchor", () => {
  it("inserts lines after the anchor line", () => {
    const lines = ["a", "b", "c"]
    const result = applyInsertAfter(lines, "1#XX", ["X", "Y"], SKIP)
    expect(result).toEqual(["a", "X", "Y", "b", "c"])
  })

  it("inserts after last line", () => {
    const lines = ["a", "b"]
    const result = applyInsertAfter(lines, "2#XX", ["c"], SKIP)
    expect(result).toEqual(["a", "b", "c"])
  })

  it("strips anchor echo from first new line", () => {
    const lines = ["function foo() {", "}"]
    // If first new line repeats the anchor, it's stripped
    const result = applyInsertAfter(lines, "1#XX", ["function foo() {", "  return 1"], SKIP)
    // First line matches anchor — gets stripped
    expect(result).toEqual(["function foo() {", "  return 1", "}"])
  })

  it("throws if text is empty after echo stripping", () => {
    const lines = ["a"]
    expect(() => applyInsertAfter(lines, "1#XX", ["a"], SKIP)).toThrow()
  })
})

describe("applyInsertBefore — prepend with anchor", () => {
  it("inserts lines before the anchor line", () => {
    const lines = ["a", "b", "c"]
    const result = applyInsertBefore(lines, "3#XX", ["X", "Y"], SKIP)
    expect(result).toEqual(["a", "b", "X", "Y", "c"])
  })

  it("inserts before first line", () => {
    const lines = ["b", "c"]
    const result = applyInsertBefore(lines, "1#XX", ["a"], SKIP)
    expect(result).toEqual(["a", "b", "c"])
  })

  it("strips anchor echo from last new line", () => {
    const lines = ["start", "function world() {"]
    // last new line matches anchor — gets stripped
    const result = applyInsertBefore(lines, "2#XX", ["const x = 1", "function world() {"], SKIP)
    expect(result).toEqual(["start", "const x = 1", "function world() {"])
  })
})

describe("applyAppend — EOF append (no anchor)", () => {
  it("appends lines to the end", () => {
    const lines = ["a", "b"]
    const result = applyAppend(lines, ["c", "d"])
    expect(result).toEqual(["a", "b", "c", "d"])
  })

  it("replaces empty file (single empty string)", () => {
    const result = applyAppend([""], ["hello", "world"])
    expect(result).toEqual(["hello", "world"])
  })

  it("throws when text is empty", () => {
    expect(() => applyAppend(["a"], [])).toThrow()
  })

  it("accepts string input", () => {
    const result = applyAppend(["a", "b"], "c")
    expect(result).toEqual(["a", "b", "c"])
  })
})

describe("applyPrepend — BOF prepend (no anchor)", () => {
  it("prepends lines to the start", () => {
    const lines = ["c", "d"]
    const result = applyPrepend(lines, ["a", "b"])
    expect(result).toEqual(["a", "b", "c", "d"])
  })

  it("replaces empty file (single empty string)", () => {
    const result = applyPrepend([""], ["hello", "world"])
    expect(result).toEqual(["hello", "world"])
  })

  it("throws when text is empty", () => {
    expect(() => applyPrepend(["a"], [])).toThrow()
  })

  it("accepts string input", () => {
    const result = applyPrepend(["b", "c"], "a")
    expect(result).toEqual(["a", "b", "c"])
  })
})
