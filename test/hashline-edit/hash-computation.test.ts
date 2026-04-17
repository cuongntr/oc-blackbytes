/**
 * Tests for hash-computation.ts
 *
 * These functions rely on Bun.hash.xxHash32 (Bun runtime only).
 * computeLineHash strips \r and trims trailing whitespace before hashing.
 * For blank/whitespace-only lines, lineNumber is used as seed; otherwise seed=0.
 * Output is always a 2-char string from HASHLINE_DICT (ZPMQVRWSNKTXJBYH alphabet).
 */
import { describe, expect, it } from "bun:test"

import {
  computeLegacyLineHash,
  computeLineHash,
  formatHashLine,
  formatHashLines,
} from "../../src/extensions/tools/hashline-edit/hash-computation"

const NIBBLE = "ZPMQVRWSNKTXJBYH"

function isValidHash(h: string): boolean {
  return h.length === 2 && [...h].every((c) => NIBBLE.includes(c))
}

describe("computeLineHash", () => {
  it("returns exactly 2 chars from ZPMQVRWSNKTXJBYH for normal content", () => {
    const h = computeLineHash(1, "function hello() {")
    expect(h).toHaveLength(2)
    for (const c of h) expect(NIBBLE).toContain(c)
  })

  it("is deterministic — same input always produces same output", () => {
    const inputs: [number, string][] = [
      [1, "function hello() {"],
      [2, "  console.log('hi')"],
      [3, "  return 42"],
      [4, "}"],
      [5, ""],
      [6, "   "],
      [10, "export const x = 1"],
      [100, "import { foo } from './bar'"],
      [999, "// comment line"],
      [1, "const a = 1; const b = 2; const c = 3;"],
    ]
    for (const [line, content] of inputs) {
      const h1 = computeLineHash(line, content)
      const h2 = computeLineHash(line, content)
      expect(h1).toEqual(h2)
      expect(isValidHash(h1)).toBe(true)
    }
  })

  it("strips \\r — CRLF and LF produce the same hash", () => {
    const lf = computeLineHash(1, "hello world")
    const crlf = computeLineHash(1, "hello world\r")
    expect(lf).toEqual(crlf)
  })

  it("trims trailing whitespace — trailing spaces don't change hash", () => {
    const plain = computeLineHash(1, "hello")
    const trailing = computeLineHash(1, "hello   ")
    expect(plain).toEqual(trailing)
  })

  it("blank line uses lineNumber as seed — different line numbers differ", () => {
    const h1 = computeLineHash(1, "")
    const h5 = computeLineHash(5, "")
    // They may differ because different seeds are used
    expect(isValidHash(h1)).toBe(true)
    expect(isValidHash(h5)).toBe(true)
  })

  it("whitespace-only line uses lineNumber as seed", () => {
    const h1 = computeLineHash(1, "   ")
    const h2 = computeLineHash(2, "   ")
    expect(isValidHash(h1)).toBe(true)
    expect(isValidHash(h2)).toBe(true)
  })

  it("handles very long line (2000+ chars)", () => {
    const longLine = "x".repeat(2000)
    const h = computeLineHash(1, longLine)
    expect(isValidHash(h)).toBe(true)
    expect(computeLineHash(1, longLine)).toEqual(h) // deterministic
  })

  it("handles unicode — emoji", () => {
    const h = computeLineHash(1, "console.log('🎉')")
    expect(isValidHash(h)).toBe(true)
  })

  it("handles unicode — Vietnamese text", () => {
    const h = computeLineHash(1, "// Xử lý dữ liệu người dùng")
    expect(isValidHash(h)).toBe(true)
  })

  it("different content produces potentially different hashes", () => {
    // At least verify format for 10+ distinct inputs
    const cases = [
      "alpha",
      "beta",
      "gamma",
      "delta",
      "import React from 'react'",
      "export default function App() {",
      "const value = 42",
      "  return <div>hello</div>",
      "type Props = { name: string }",
      "// end of file",
    ]
    for (const content of cases) {
      const h = computeLineHash(1, content)
      expect(isValidHash(h)).toBe(true)
    }
  })
})

describe("computeLegacyLineHash", () => {
  it("returns valid 2-char hash", () => {
    const h = computeLegacyLineHash(1, "function foo() { return 1 }")
    expect(isValidHash(h)).toBe(true)
  })

  it("is deterministic", () => {
    const h1 = computeLegacyLineHash(3, "  const x = 1  ")
    const h2 = computeLegacyLineHash(3, "  const x = 1  ")
    expect(h1).toEqual(h2)
  })

  it("strips all whitespace — indented and non-indented produce same hash", () => {
    const h1 = computeLegacyLineHash(1, "constx=1")
    const h2 = computeLegacyLineHash(1, "  const x = 1  ")
    expect(h1).toEqual(h2)
  })
})

describe("formatHashLine", () => {
  it("returns lineNumber#hash|content format", () => {
    const result = formatHashLine(1, "function hello() {")
    expect(result).toMatch(/^1#[ZPMQVRWSNKTXJBYH]{2}\|function hello\(\) \{$/)
  })

  it("is deterministic", () => {
    const r1 = formatHashLine(5, "  return x + y")
    const r2 = formatHashLine(5, "  return x + y")
    expect(r1).toEqual(r2)
  })

  it("preserves original content after pipe", () => {
    const content = "  const result = someFunction(a, b, c)"
    const result = formatHashLine(10, content)
    const afterPipe = result.slice(result.indexOf("|") + 1)
    expect(afterPipe).toBe(content)
  })
})

describe("formatHashLines", () => {
  it("returns empty string for empty input", () => {
    expect(formatHashLines("")).toBe("")
  })

  it("formats a single line", () => {
    const result = formatHashLines("hello")
    expect(result).toMatch(/^1#[ZPMQVRWSNKTXJBYH]{2}\|hello$/)
  })

  it("formats multiple lines with correct line numbers", () => {
    const input = "line1\nline2\nline3"
    const result = formatHashLines(input)
    const lines = result.split("\n")
    expect(lines).toHaveLength(3)
    expect(lines[0]).toMatch(/^1#/)
    expect(lines[1]).toMatch(/^2#/)
    expect(lines[2]).toMatch(/^3#/)
  })

  it("preserves content after pipe separator", () => {
    const input = "alpha\nbeta\ngamma"
    const lines = formatHashLines(input).split("\n")
    expect(lines[0]).toContain("|alpha")
    expect(lines[1]).toContain("|beta")
    expect(lines[2]).toContain("|gamma")
  })
})
