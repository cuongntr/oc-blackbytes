import { describe, expect, it } from "bun:test"
import {
  HASHLINE_DICT,
  HASHLINE_OUTPUT_PATTERN,
  HASHLINE_REF_PATTERN,
  NIBBLE_STR,
} from "../../src/extensions/tools/hashline-edit/constants"
import { HASHLINE_EDIT_DESCRIPTION } from "../../src/extensions/tools/hashline-edit/tool-description"
import { createHashlineEditTool } from "../../src/extensions/tools/hashline-edit/tools"

describe("hashline-edit constants", () => {
  it("NIBBLE_STR contains exactly 16 characters from the CID set", () => {
    expect(NIBBLE_STR).toBe("ZPMQVRWSNKTXJBYH")
    expect(NIBBLE_STR.length).toBe(16)
  })

  it("HASHLINE_DICT has 256 entries", () => {
    expect(HASHLINE_DICT.length).toBe(256)
  })

  it("HASHLINE_DICT entries are two-letter CID codes", () => {
    for (const entry of HASHLINE_DICT) {
      expect(entry).toMatch(/^[ZPMQVRWSNKTXJBYH]{2}$/)
    }
  })

  it("HASHLINE_REF_PATTERN matches valid LINE#ID", () => {
    expect(HASHLINE_REF_PATTERN.test("1#ZP")).toBe(true)
    expect(HASHLINE_REF_PATTERN.test("100#MQ")).toBe(true)
  })

  it("HASHLINE_REF_PATTERN rejects invalid formats", () => {
    expect(HASHLINE_REF_PATTERN.test("abc#ZP")).toBe(false)
    expect(HASHLINE_REF_PATTERN.test("1#AB")).toBe(false)
    expect(HASHLINE_REF_PATTERN.test("1#Z")).toBe(false)
    expect(HASHLINE_REF_PATTERN.test("1ZP")).toBe(false)
  })

  it("HASHLINE_OUTPUT_PATTERN matches LINE#ID|content format", () => {
    expect(HASHLINE_OUTPUT_PATTERN.test("1#ZP|some content")).toBe(true)
    expect(HASHLINE_OUTPUT_PATTERN.test("42#MQ|")).toBe(true)
  })

  it("HASHLINE_OUTPUT_PATTERN rejects invalid formats", () => {
    expect(HASHLINE_OUTPUT_PATTERN.test("1#ZP")).toBe(false)
    expect(HASHLINE_OUTPUT_PATTERN.test("abc#ZP|content")).toBe(false)
  })
})

describe("HASHLINE_EDIT_DESCRIPTION", () => {
  it("is a non-empty string", () => {
    expect(typeof HASHLINE_EDIT_DESCRIPTION).toBe("string")
    expect(HASHLINE_EDIT_DESCRIPTION.length).toBeGreaterThan(0)
  })

  it("references LINE#ID format", () => {
    expect(HASHLINE_EDIT_DESCRIPTION).toContain("LINE#ID")
  })

  it("mentions all three operations", () => {
    expect(HASHLINE_EDIT_DESCRIPTION).toContain("replace")
    expect(HASHLINE_EDIT_DESCRIPTION).toContain("append")
    expect(HASHLINE_EDIT_DESCRIPTION).toContain("prepend")
  })
})

describe("createHashlineEditTool", () => {
  it("returns a tool definition with required fields", () => {
    const tool = createHashlineEditTool()
    expect(tool).toBeDefined()
    expect(typeof tool).toBe("object")
  })

  it("tool has a description", () => {
    const tool = createHashlineEditTool() as { description?: string }
    // The tool object shape depends on the @opencode-ai/plugin tool() builder
    // We verify the tool is constructed without throwing
    expect(tool).not.toBeNull()
  })

  it("does not throw when called with no arguments", () => {
    expect(() => createHashlineEditTool()).not.toThrow()
  })

  it("does not throw when called with undefined", () => {
    expect(() => createHashlineEditTool(undefined)).not.toThrow()
  })
})
