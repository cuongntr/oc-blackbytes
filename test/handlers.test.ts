import { describe, expect, it } from "bun:test"

/**
 * Tests for the line count formula used in tool-execute-after-handler.ts.
 *
 * The formula (line 164 of the handler):
 *   content === "" ? 0 : content.endsWith("\n") ? lines.length - 1 : lines.length
 *
 * This handles trailing newlines correctly: "hello\n".split("\n") yields
 * ["hello", ""], so we subtract 1 when content ends with "\n".
 */
function countLines(content: string): number {
  const lines = content.split("\n")
  return content === "" ? 0 : content.endsWith("\n") ? lines.length - 1 : lines.length
}

describe("tool-execute-after write line count", () => {
  it('counts "hello\\n" (trailing newline) as 1 line', () => {
    expect(countLines("hello\n")).toBe(1)
  })

  it('counts "hello" (no trailing newline) as 1 line', () => {
    expect(countLines("hello")).toBe(1)
  })

  it('counts "hello\\nworld\\n" as 2 lines', () => {
    expect(countLines("hello\nworld\n")).toBe(2)
  })

  it('counts "" (empty string) as 0 lines', () => {
    expect(countLines("")).toBe(0)
  })

  it('counts "a\\nb\\nc" (no trailing newline) as 3 lines', () => {
    expect(countLines("a\nb\nc")).toBe(3)
  })
})
