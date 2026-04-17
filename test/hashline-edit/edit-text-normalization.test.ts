import { describe, expect, it } from "bun:test"

import {
  restoreLeadingIndent,
  stripInsertAnchorEcho,
  stripInsertBeforeEcho,
  stripLinePrefixes,
  stripRangeBoundaryEcho,
  toNewLines,
} from "../../src/extensions/tools/hashline-edit/edit-text-normalization"

describe("stripLinePrefixes", () => {
  it("strips hashline prefixes when majority of lines have them", () => {
    const lines = ["10#VK|function hello() {", "11#XJ|  console.log('hi');", "12#MB|}"]
    const result = stripLinePrefixes(lines)
    expect(result).toEqual(["function hello() {", "  console.log('hi');", "}"])
  })

  it("strips diff + markers when majority of lines have them", () => {
    const lines = ["+function hello() {", "+  console.log('hi');", "+}"]
    const result = stripLinePrefixes(lines)
    expect(result).toEqual(["function hello() {", "  console.log('hi');", "}"])
  })

  it("does not strip when fewer than 50% of non-empty lines have prefix", () => {
    const lines = ["10#VK|function hello() {", "  plain line", "  another plain"]
    const result = stripLinePrefixes(lines)
    expect(result).toEqual(lines)
  })

  it("returns unchanged for empty array", () => {
    expect(stripLinePrefixes([])).toEqual([])
  })

  it("returns unchanged when no prefixes detected", () => {
    const lines = ["function foo() {", "  return 1", "}"]
    expect(stripLinePrefixes(lines)).toEqual(lines)
  })

  it("skips empty lines when counting", () => {
    const lines = ["1#ZP|alpha", "", "3#MQ|gamma"]
    const result = stripLinePrefixes(lines)
    expect(result).toEqual(["alpha", "", "gamma"])
  })

  it("does not strip ++ diff markers (only single +)", () => {
    const lines = ["++conflict marker", "+actual add"]
    // only 1/2 start with single +, but ++ is not matched
    // "actual add" has +, "++conflict" starts with ++ so not matched by DIFF_PLUS_RE
    // So 1 out of 2 non-empty = 50% exactly, which satisfies >= 0.5
    const result = stripLinePrefixes(lines)
    // "++conflict marker" stays since DIFF_PLUS_RE won't match it
    // "+actual add" -> "actual add"
    expect(result[1]).toBe("actual add")
  })
})

describe("toNewLines", () => {
  it("splits string by newline", () => {
    const result = toNewLines("a\nb\nc")
    expect(result).toEqual(["a", "b", "c"])
  })

  it("passes array through stripLinePrefixes", () => {
    const input = ["1#ZP|foo", "2#MQ|bar"]
    const result = toNewLines(input)
    expect(result).toEqual(["foo", "bar"])
  })

  it("handles string with hashline prefixes", () => {
    const result = toNewLines("1#ZP|hello\n2#MQ|world")
    expect(result).toEqual(["hello", "world"])
  })
})

describe("restoreLeadingIndent", () => {
  it("adds template indent when line has none", () => {
    const result = restoreLeadingIndent("  return x", "return x + 1")
    expect(result).toBe("  return x + 1")
  })

  it("does not modify if line already has indent", () => {
    const result = restoreLeadingIndent("  template", "  already indented")
    expect(result).toBe("  already indented")
  })

  it("does not modify if template has no indent", () => {
    const result = restoreLeadingIndent("noIndent", "also no indent")
    expect(result).toBe("also no indent")
  })

  it("does not modify empty line", () => {
    expect(restoreLeadingIndent("  template", "")).toBe("")
  })

  it("does not add indent when content matches template (same trimmed)", () => {
    const result = restoreLeadingIndent("  return x", "return x")
    // same trimmed content -> no indent added
    expect(result).toBe("return x")
  })
})

describe("stripInsertAnchorEcho", () => {
  it("removes first line if it equals the anchor (ignoring whitespace)", () => {
    const anchor = "function hello() {"
    const newLines = ["function hello() {", "  console.log('hi');", "}"]
    const result = stripInsertAnchorEcho(anchor, newLines)
    expect(result).toEqual(["  console.log('hi');", "}"])
  })

  it("does not remove first line if different from anchor", () => {
    const anchor = "function hello() {"
    const newLines = ["const x = 1", "}"]
    const result = stripInsertAnchorEcho(anchor, newLines)
    expect(result).toEqual(["const x = 1", "}"])
  })

  it("returns empty if only line matches anchor", () => {
    const anchor = "}"
    const result = stripInsertAnchorEcho(anchor, ["}"])
    expect(result).toEqual([])
  })

  it("handles whitespace-only difference", () => {
    const anchor = "  function foo() {"
    const newLines = ["function foo() {", "  return 1", "}"]
    const result = stripInsertAnchorEcho(anchor, newLines)
    expect(result).toEqual(["  return 1", "}"])
  })

  it("returns unchanged for empty newLines", () => {
    expect(stripInsertAnchorEcho("anchor", [])).toEqual([])
  })
})

describe("stripInsertBeforeEcho", () => {
  it("removes last line if it equals the anchor (ignoring whitespace)", () => {
    const anchor = "function world() {"
    const newLines = ["const x = 1", "", "function world() {"]
    const result = stripInsertBeforeEcho(anchor, newLines)
    expect(result).toEqual(["const x = 1", ""])
  })

  it("does not remove if last line differs", () => {
    const anchor = "function world() {"
    const newLines = ["const x = 1", "const y = 2"]
    const result = stripInsertBeforeEcho(anchor, newLines)
    expect(result).toEqual(["const x = 1", "const y = 2"])
  })

  it("returns unchanged if only 1 line (to avoid empty result)", () => {
    const result = stripInsertBeforeEcho("}", ["}"])
    expect(result).toEqual(["}"])
  })
})

describe("stripRangeBoundaryEcho", () => {
  it("strips leading boundary echo (line before replaced range)", () => {
    // lines: ['a', 'b', 'c', 'd', 'e']
    // replacing lines 2-3 (b,c) with ['b', 'X', 'd']
    // 'b' is lines[beforeIdx=0] = 'a'? No, beforeIdx = startLine-2 = 0 => lines[0]='a'
    // Let's use a clear example:
    const lines = ["before", "target1", "target2", "after"]
    // replacing lines 2-3
    // beforeIdx = 2-2 = 0 => lines[0] = 'before'
    // afterIdx = 3 => lines[3] = 'after'
    // if newLines includes 'before' at start -> strip it
    const newLines = ["before", "new content", "after"]
    const result = stripRangeBoundaryEcho(lines, 2, 3, newLines)
    expect(result).toEqual(["new content"])
  })

  it("does not strip if newLines count <= replaced count", () => {
    const lines = ["a", "b", "c"]
    // replacing 1 line with 1 line — newLines.length (1) <= replacedCount (1)
    const result = stripRangeBoundaryEcho(lines, 2, 2, ["b"])
    expect(result).toEqual(["b"])
  })

  it("does not strip if only 1 new line", () => {
    const lines = ["a", "b", "c"]
    const result = stripRangeBoundaryEcho(lines, 2, 2, ["new"])
    expect(result).toEqual(["new"])
  })
})
