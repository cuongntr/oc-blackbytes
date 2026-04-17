import { describe, expect, it } from "bun:test"

import {
  autocorrectReplacementLines,
  maybeExpandSingleLineMerge,
  restoreIndentForPairedReplacement,
  restoreOldWrappedLines,
} from "../../src/extensions/tools/hashline-edit/autocorrect-replacement-lines"

describe("maybeExpandSingleLineMerge", () => {
  it("expands a single replacement line back into the original multi-line shape", () => {
    const original = ["const a = 1", "const b = 2"]
    const replacement = ["const a = 1 const b = 2"]
    const result = maybeExpandSingleLineMerge(original, replacement)
    expect(result).toHaveLength(2)
  })

  it("returns replacement unchanged if replacement already has multiple lines", () => {
    const original = ["const a = 1", "const b = 2"]
    const replacement = ["const a = 1", "const b = 2"]
    expect(maybeExpandSingleLineMerge(original, replacement)).toEqual(replacement)
  })

  it("returns replacement unchanged if original has only 1 line", () => {
    const original = ["const x = 1"]
    const replacement = ["const x = 2"]
    expect(maybeExpandSingleLineMerge(original, replacement)).toEqual(replacement)
  })

  it("splits by semicolons when direct match fails", () => {
    const original = ["const a = 1;", "const b = 2;"]
    const replacement = ["const a = 1; const b = 2;"]
    const result = maybeExpandSingleLineMerge(original, replacement)
    expect(result).toHaveLength(2)
    expect(result[0]).toContain("const a = 1")
    expect(result[1]).toContain("const b = 2")
  })
})

describe("restoreOldWrappedLines", () => {
  it("collapses multi-line replacement back to original single line", () => {
    const original = ["const longFunctionCall = doSomething(a, b, c)"]
    const replacement = ["const longFunctionCall = doSomething(", "  a, b, c", ")"]
    const result = restoreOldWrappedLines(original, replacement)
    expect(result).toEqual(["const longFunctionCall = doSomething(a, b, c)"])
  })

  it("returns replacement unchanged if no match found", () => {
    const original = ["const x = 1"]
    const replacement = ["const y = 2", "const z = 3"]
    const result = restoreOldWrappedLines(original, replacement)
    expect(result).toEqual(replacement)
  })

  it("returns replacement unchanged if original is empty", () => {
    const result = restoreOldWrappedLines([], ["a", "b"])
    expect(result).toEqual(["a", "b"])
  })

  it("returns replacement unchanged if fewer than 2 replacement lines", () => {
    const result = restoreOldWrappedLines(["original"], ["single"])
    expect(result).toEqual(["single"])
  })

  it("does not collapse if canonical length is too short (< 6 chars)", () => {
    const original = ["ab"]
    const replacement = ["a", "b"]
    // canonicalSpan = "ab" which is length 2 < 6
    const result = restoreOldWrappedLines(original, replacement)
    expect(result).toEqual(replacement)
  })
})

describe("restoreIndentForPairedReplacement", () => {
  it("restores indentation when original and replacement have same length", () => {
    const original = ["  const x = 1", "  const y = 2"]
    const replacement = ["const x = 10", "const y = 20"]
    const result = restoreIndentForPairedReplacement(original, replacement)
    expect(result[0]).toBe("  const x = 10")
    expect(result[1]).toBe("  const y = 20")
  })

  it("returns replacement unchanged if lengths differ", () => {
    const original = ["  const x = 1"]
    const replacement = ["const x = 1", "const y = 2"]
    const result = restoreIndentForPairedReplacement(original, replacement)
    expect(result).toEqual(replacement)
  })

  it("does not modify lines that already have indentation", () => {
    const original = ["  const x = 1"]
    const replacement = ["    const x = 99"]
    const result = restoreIndentForPairedReplacement(original, replacement)
    expect(result[0]).toBe("    const x = 99")
  })

  it("does not add indent when trimmed content matches original trimmed", () => {
    const original = ["  const x = 1"]
    const replacement = ["const x = 1"]
    // same trimmed content -> no indent added
    const result = restoreIndentForPairedReplacement(original, replacement)
    expect(result[0]).toBe("const x = 1")
  })

  it("does not add indent to empty lines", () => {
    const original = ["  function foo() {", "  }"]
    const replacement = ["function foo() {", ""]
    const result = restoreIndentForPairedReplacement(original, replacement)
    expect(result[1]).toBe("")
  })
})

describe("autocorrectReplacementLines", () => {
  it("applies maybeExpandSingleLineMerge", () => {
    const original = ["const a = 1;", "const b = 2;"]
    const replacement = ["const a = 1; const b = 2;"]
    const result = autocorrectReplacementLines(original, replacement)
    expect(result).toHaveLength(2)
  })

  it("applies restoreOldWrappedLines", () => {
    const original = ["const longFunctionCall = doSomethingSpecial(x, y, z)"]
    const replacement = ["const longFunctionCall = doSomethingSpecial(", "  x, y, z", ")"]
    const result = autocorrectReplacementLines(original, replacement)
    expect(result).toEqual(["const longFunctionCall = doSomethingSpecial(x, y, z)"])
  })

  it("applies restoreIndentForPairedReplacement", () => {
    const original = ["  const value = 42"]
    const replacement = ["const value = 99"]
    const result = autocorrectReplacementLines(original, replacement)
    expect(result[0]).toBe("  const value = 99")
  })

  it("idempotency — autocorrect(autocorrect(x)) deepEquals autocorrect(x)", () => {
    const cases: [string[], string[]][] = [
      [["  const a = 1"], ["const a = 2"]],
      [["const x = foo(a, b, c)"], ["const x = foo(", "  a, b, c", ")"]],
      [["alpha", "beta"], ["alpha beta"]],
    ]
    for (const [original, replacement] of cases) {
      const once = autocorrectReplacementLines(original, replacement)
      const twice = autocorrectReplacementLines(original, once)
      expect(twice).toEqual(once)
    }
  })

  it("returns replacement unchanged when no correction applies", () => {
    const original = ["const x = 1"]
    const replacement = ["const x = 2"]
    // Same length, different content — indent is same (none)
    const result = autocorrectReplacementLines(original, replacement)
    expect(result).toEqual(["const x = 2"])
  })
})
