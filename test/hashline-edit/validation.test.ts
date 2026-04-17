/**
 * Tests for validation.ts
 *
 * parseLineRef: parses "{line_number}#{hash_id}" references, throws on invalid format.
 * validateLineRef: validates a single ref against file lines, throws HashlineMismatchError on hash mismatch.
 * validateLineRefs: validates multiple refs, aggregates mismatches.
 * HashlineMismatchError: structure — remaps map, recovery contract (updated LINE#ID tags in message).
 * normalizeLineRef: strips diff/pipe markers from refs.
 */
import { describe, expect, it } from "bun:test"

import { computeLineHash } from "../../src/extensions/tools/hashline-edit/hash-computation"
import {
  HashlineMismatchError,
  normalizeLineRef,
  parseLineRef,
  validateLineRef,
  validateLineRefs,
} from "../../src/extensions/tools/hashline-edit/validation"

function makeRef(line: number, content: string): string {
  return `${line}#${computeLineHash(line, content)}`
}

describe("parseLineRef — valid formats", () => {
  it("parses standard LINE#ID format", () => {
    const ref = makeRef(1, "function hello() {")
    const { line, hash } = parseLineRef(ref)
    expect(line).toBe(1)
    expect(hash).toHaveLength(2)
  })

  it("parses multi-digit line numbers", () => {
    const ref = makeRef(100, "const x = 1")
    const { line } = parseLineRef(ref)
    expect(line).toBe(100)
  })

  it("normalizes before parsing — strips >>> prefix", () => {
    const ref = makeRef(3, "hello")
    const { line, hash } = parseLineRef(`>>> ${ref}|hello`)
    expect(line).toBe(3)
    expect(hash).toHaveLength(2)
  })

  it("normalizes before parsing — strips pipe suffix", () => {
    const ref = makeRef(5, "world")
    const { line } = parseLineRef(`${ref}|world content here`)
    expect(line).toBe(5)
  })
})

describe("parseLineRef — invalid formats", () => {
  it("throws on completely invalid string", () => {
    expect(() => parseLineRef("not-a-ref")).toThrow("Invalid line reference format")
  })

  it("throws with message containing the bad ref", () => {
    expect(() => parseLineRef("badref")).toThrow("badref")
  })

  it("throws when line number is not numeric", () => {
    expect(() => parseLineRef("abc#XY")).toThrow("is not a line number")
  })

  it("throws with format hint in message", () => {
    expect(() => parseLineRef("notanumber")).toThrow("{line_number}#{hash_id}")
  })
})

describe("normalizeLineRef", () => {
  it("passes through a valid ref unchanged", () => {
    const ref = "5#AB"
    expect(normalizeLineRef(ref)).toBe("5#AB")
  })

  it("strips >>> prefix", () => {
    expect(normalizeLineRef(">>> 3#XY|content")).toBe("3#XY")
  })

  it("strips pipe and trailing content", () => {
    expect(normalizeLineRef("7#MN|some content here")).toBe("7#MN")
  })

  it("strips leading +/- diff markers", () => {
    // Use valid ZPMQVRWSNKTXJBYH chars — not all letters are in the dict
    expect(normalizeLineRef("+ 2#KT")).toBe("2#KT")
    expect(normalizeLineRef("- 2#KT")).toBe("2#KT")
  })

  it("trims surrounding whitespace", () => {
    expect(normalizeLineRef("  10#AB  ")).toBe("10#AB")
  })
})

describe("validateLineRef", () => {
  const lines = ["function hello() {", "  return 42", "}"]

  it("does not throw when ref matches line content", () => {
    const ref = makeRef(1, lines[0])
    expect(() => validateLineRef(lines, ref)).not.toThrow()
  })

  it("does not throw for last line", () => {
    const ref = makeRef(3, lines[2])
    expect(() => validateLineRef(lines, ref)).not.toThrow()
  })

  it("throws HashlineMismatchError when hash does not match content", () => {
    const wrongRef = `1#${computeLineHash(1, "completely different content")}`
    expect(() => validateLineRef(lines, wrongRef)).toThrow(HashlineMismatchError)
  })

  it("throws on out-of-bounds line number", () => {
    const ref = makeRef(99, "")
    expect(() => validateLineRef(lines, ref)).toThrow("out of bounds")
  })
})

describe("HashlineMismatchError — structure", () => {
  const fileLines = ["first line", "second line", "third line"]

  it("has name HashlineMismatchError", () => {
    const wrongRef = `2#${computeLineHash(2, "wrong content")}`
    try {
      validateLineRef(fileLines, wrongRef)
      expect(true).toBe(false) // should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(HashlineMismatchError)
      expect((err as HashlineMismatchError).name).toBe("HashlineMismatchError")
    }
  })

  it("remaps contains updated tag for the mismatched line", () => {
    const wrongHash = computeLineHash(2, "wrong content")
    const wrongRef = `2#${wrongHash}`
    try {
      validateLineRef(fileLines, wrongRef)
    } catch (err) {
      expect(err).toBeInstanceOf(HashlineMismatchError)
      const mismatch = err as HashlineMismatchError
      const correctHash = computeLineHash(2, fileLines[1])
      expect(mismatch.remaps.get(`2#${wrongHash}`)).toBe(`2#${correctHash}`)
    }
  })

  it("error message contains >>> marker for changed lines", () => {
    const wrongHash = computeLineHash(2, "wrong content")
    const wrongRef = `2#${wrongHash}`
    try {
      validateLineRef(fileLines, wrongRef)
    } catch (err) {
      const mismatch = err as HashlineMismatchError
      expect(mismatch.message).toContain(">>>")
    }
  })

  it("error message contains recovery instruction", () => {
    const wrongHash = computeLineHash(1, "old content")
    try {
      validateLineRef(fileLines, `1#${wrongHash}`)
    } catch (err) {
      const mismatch = err as HashlineMismatchError
      expect(mismatch.message).toContain("{line_number}#{hash_id}")
    }
  })

  it("error message includes updated LINE#ID tags for recovery", () => {
    const wrongHash = computeLineHash(2, "stale content")
    try {
      validateLineRef(fileLines, `2#${wrongHash}`)
    } catch (err) {
      const mismatch = err as HashlineMismatchError
      // The message should show the correct tag for line 2
      const correctTag = `2#${computeLineHash(2, fileLines[1])}`
      expect(mismatch.message).toContain(correctTag)
    }
  })

  it("mismatches array contains the mismatch details", () => {
    const wrongHash = computeLineHash(3, "wrong")
    try {
      validateLineRef(fileLines, `3#${wrongHash}`)
    } catch (err) {
      const mismatch = err as HashlineMismatchError
      expect(mismatch.mismatches).toHaveLength(1)
      expect(mismatch.mismatches[0].line).toBe(3)
    }
  })
})

describe("validateLineRefs — multiple refs", () => {
  const fileLines = ["alpha", "beta", "gamma", "delta"]

  it("validates all correct refs without throwing", () => {
    const refs = [makeRef(1, fileLines[0]), makeRef(3, fileLines[2])]
    expect(() => validateLineRefs(fileLines, refs)).not.toThrow()
  })

  it("throws HashlineMismatchError aggregating all mismatches", () => {
    const badRef1 = `1#${computeLineHash(1, "wrong1")}`
    const badRef2 = `3#${computeLineHash(3, "wrong3")}`
    try {
      validateLineRefs(fileLines, [badRef1, badRef2])
    } catch (err) {
      expect(err).toBeInstanceOf(HashlineMismatchError)
      const mismatch = err as HashlineMismatchError
      expect(mismatch.mismatches).toHaveLength(2)
    }
  })

  it("partial mismatch — reports only the bad ones", () => {
    const goodRef = makeRef(2, fileLines[1])
    const badRef = `4#${computeLineHash(4, "stale delta")}`
    try {
      validateLineRefs(fileLines, [goodRef, badRef])
    } catch (err) {
      const mismatch = err as HashlineMismatchError
      expect(mismatch.mismatches).toHaveLength(1)
      expect(mismatch.mismatches[0].line).toBe(4)
    }
  })
})
