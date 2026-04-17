/**
 * Tests for file-text-canonicalization.ts
 *
 * canonicalizeFileText: strips BOM, normalizes CRLF→LF, detects original line ending.
 * restoreFileText: re-applies original line ending and BOM.
 * Round-trip: restoreFileText(canonicalized, envelope) === original (modulo documented normalization).
 */
import { describe, expect, it } from "bun:test"

import {
  canonicalizeFileText,
  restoreFileText,
} from "../../src/extensions/tools/hashline-edit/file-text-canonicalization"

describe("canonicalizeFileText", () => {
  it("LF-only file — no BOM, no CRLF", () => {
    const content = "line1\nline2\nline3\n"
    const env = canonicalizeFileText(content)
    expect(env.hadBom).toBe(false)
    expect(env.lineEnding).toBe("\n")
    expect(env.content).toBe("line1\nline2\nline3\n")
  })

  it("CRLF file — detects CRLF and normalizes to LF", () => {
    const content = "line1\r\nline2\r\nline3\r\n"
    const env = canonicalizeFileText(content)
    expect(env.hadBom).toBe(false)
    expect(env.lineEnding).toBe("\r\n")
    expect(env.content).toBe("line1\nline2\nline3\n")
  })

  it("UTF-8 BOM file — strips BOM and records hadBom", () => {
    const content = "\uFEFFline1\nline2\n"
    const env = canonicalizeFileText(content)
    expect(env.hadBom).toBe(true)
    expect(env.lineEnding).toBe("\n")
    expect(env.content).toBe("line1\nline2\n")
    expect(env.content.startsWith("\uFEFF")).toBe(false)
  })

  it("UTF-8 BOM + CRLF — strips BOM and normalizes CRLF", () => {
    const content = "\uFEFFline1\r\nline2\r\n"
    const env = canonicalizeFileText(content)
    expect(env.hadBom).toBe(true)
    expect(env.lineEnding).toBe("\r\n")
    expect(env.content).toBe("line1\nline2\n")
  })

  it("no trailing newline — LF file", () => {
    const content = "line1\nline2"
    const env = canonicalizeFileText(content)
    expect(env.hadBom).toBe(false)
    expect(env.lineEnding).toBe("\n")
    expect(env.content).toBe("line1\nline2")
  })

  it("bare CR (\\r) is normalized to LF", () => {
    const content = "line1\rline2\r"
    const env = canonicalizeFileText(content)
    // bare CR not counted as CRLF ending
    expect(env.content).toBe("line1\nline2\n")
  })

  it("empty string", () => {
    const env = canonicalizeFileText("")
    expect(env.hadBom).toBe(false)
    expect(env.lineEnding).toBe("\n")
    expect(env.content).toBe("")
  })

  it("single line no newline", () => {
    const env = canonicalizeFileText("hello")
    expect(env.content).toBe("hello")
    expect(env.hadBom).toBe(false)
    expect(env.lineEnding).toBe("\n")
  })
})

describe("restoreFileText round-trip", () => {
  function roundTrip(original: string): string {
    const env = canonicalizeFileText(original)
    return restoreFileText(env.content, env)
  }

  it("LF file round-trips exactly", () => {
    const original = "line1\nline2\nline3\n"
    expect(roundTrip(original)).toBe(original)
  })

  it("CRLF file round-trips exactly", () => {
    const original = "line1\r\nline2\r\nline3\r\n"
    expect(roundTrip(original)).toBe(original)
  })

  it("BOM + LF round-trips exactly", () => {
    const original = "\uFEFFhello\nworld\n"
    expect(roundTrip(original)).toBe(original)
  })

  it("BOM + CRLF round-trips exactly", () => {
    const original = "\uFEFFhello\r\nworld\r\n"
    expect(roundTrip(original)).toBe(original)
  })

  it("no trailing newline round-trips exactly", () => {
    const original = "line1\nline2"
    expect(roundTrip(original)).toBe(original)
  })

  it("empty string round-trips", () => {
    expect(roundTrip("")).toBe("")
  })
})

describe("restoreFileText — explicit scenarios", () => {
  it("restores CRLF from LF-normalized content", () => {
    const env = { content: "a\nb\n", hadBom: false, lineEnding: "\r\n" as const }
    const restored = restoreFileText("a\nb\n", env)
    expect(restored).toBe("a\r\nb\r\n")
  })

  it("re-adds BOM", () => {
    const env = { content: "hello\n", hadBom: true, lineEnding: "\n" as const }
    const restored = restoreFileText("hello\n", env)
    expect(restored.startsWith("\uFEFF")).toBe(true)
    expect(restored).toBe("\uFEFFhello\n")
  })

  it("no BOM — does not add BOM", () => {
    const env = { content: "hello\n", hadBom: false, lineEnding: "\n" as const }
    const restored = restoreFileText("hello\n", env)
    expect(restored.startsWith("\uFEFF")).toBe(false)
  })
})
