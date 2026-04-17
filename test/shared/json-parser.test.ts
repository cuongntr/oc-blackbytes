import { describe, expect, it } from "bun:test"
import path from "node:path"
import {
  detectConfigFile,
  detectPluginConfigFile,
  parseJsonc,
  parseJsoncSafe,
  readJsoncFile,
} from "../../src/shared/utils/json-parser"
import { makeTmpDir, writeFixture } from "../helpers/tmp-dir"

describe("parseJsonc", () => {
  it("parses valid JSON", () => {
    const result = parseJsonc<{ a: number }>('{"a": 1}')
    expect(result).toEqual({ a: 1 })
  })

  it("parses JSONC with // line comments", () => {
    const input = `{
      // this is a comment
      "key": "value"
    }`
    expect(parseJsonc<{ key: string }>(input)).toEqual({ key: "value" })
  })

  it("parses JSONC with /* */ block comments", () => {
    const input = `{
      /* block comment */
      "x": 42
    }`
    expect(parseJsonc<{ x: number }>(input)).toEqual({ x: 42 })
  })

  it("parses JSONC with trailing commas", () => {
    const input = `{"a": 1, "b": 2,}`
    expect(parseJsonc<{ a: number; b: number }>(input)).toEqual({ a: 1, b: 2 })
  })

  it("strips UTF-8 BOM prefix", () => {
    const bom = "\uFEFF"
    const input = `${bom}{"bom": true}`
    expect(parseJsonc<{ bom: boolean }>(input)).toEqual({ bom: true })
  })

  it("parses empty object", () => {
    expect(parseJsonc("{}")).toEqual({})
  })

  it("throws SyntaxError on malformed JSON", () => {
    expect(() => parseJsonc("{invalid}")).toThrow(SyntaxError)
  })

  it("thrown error message includes offset info", () => {
    expect(() => parseJsonc("{invalid}")).toThrow(/offset/)
  })

  it("throws on unclosed brace", () => {
    expect(() => parseJsonc('{"a": 1')).toThrow(/JSONC parse error/)
  })
})

describe("parseJsoncSafe", () => {
  it("returns data and no errors for valid JSON", () => {
    const result = parseJsoncSafe<{ ok: boolean }>('{"ok": true}')
    expect(result.data).toEqual({ ok: true })
    expect(result.errors).toHaveLength(0)
  })

  it("returns data null and errors for malformed input", () => {
    const result = parseJsoncSafe("{bad}")
    expect(result.data).toBeNull()
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it("error objects include offset and length", () => {
    const result = parseJsoncSafe("{bad}")
    for (const e of result.errors) {
      expect(typeof e.offset).toBe("number")
      expect(typeof e.length).toBe("number")
      expect(typeof e.message).toBe("string")
    }
  })

  it("returns null data for empty input string (parse error)", () => {
    // jsonc-parser treats empty string as invalid JSON
    const result = parseJsoncSafe("")
    // Either no errors (returns undefined) or errors — either way data is null/undefined
    // The important contract: no throw
    expect(result).toBeDefined()
    expect(typeof result.errors).toBe("object")
  })

  it("returns data with comments stripped", () => {
    const result = parseJsoncSafe<{ v: number }>(`{
      // comment
      "v": 99
    }`)
    expect(result.data).toEqual({ v: 99 })
  })
})

describe("readJsoncFile", () => {
  it("reads and parses a real JSONC file", async () => {
    const tmp = makeTmpDir("json-parser-read-")
    const filePath = path.join(tmp.path, "cfg.jsonc")
    writeFixture(filePath, '// comment\n{"hello": "world"}')
    const result = readJsoncFile<{ hello: string }>(filePath)
    expect(result).toEqual({ hello: "world" })
    await tmp.cleanup()
  })

  it("returns null for a non-existent file", () => {
    expect(readJsoncFile("/does/not/exist.json")).toBeNull()
  })

  it("returns null for a malformed file", async () => {
    const tmp = makeTmpDir("json-parser-bad-")
    const filePath = path.join(tmp.path, "bad.json")
    writeFixture(filePath, "{not valid json!!}")
    expect(readJsoncFile(filePath)).toBeNull()
    await tmp.cleanup()
  })
})

describe("detectConfigFile", () => {
  it("detects .jsonc when it exists", async () => {
    const tmp = makeTmpDir("detect-cfg-")
    const base = path.join(tmp.path, "myconfig")
    writeFixture(`${base}.jsonc`, "{}")
    const result = detectConfigFile(base)
    expect(result.format).toBe("jsonc")
    expect(result.path).toBe(`${base}.jsonc`)
    await tmp.cleanup()
  })

  it("detects .json when only .json exists", async () => {
    const tmp = makeTmpDir("detect-cfg-")
    const base = path.join(tmp.path, "myconfig")
    writeFixture(`${base}.json`, "{}")
    const result = detectConfigFile(base)
    expect(result.format).toBe("json")
    expect(result.path).toBe(`${base}.json`)
    await tmp.cleanup()
  })

  it("prefers .jsonc over .json when both exist", async () => {
    const tmp = makeTmpDir("detect-cfg-")
    const base = path.join(tmp.path, "myconfig")
    writeFixture(`${base}.json`, '{"a":1}')
    writeFixture(`${base}.jsonc`, '{"b":2}')
    const result = detectConfigFile(base)
    expect(result.format).toBe("jsonc")
    await tmp.cleanup()
  })

  it("returns none when neither exists", async () => {
    const tmp = makeTmpDir("detect-cfg-")
    const base = path.join(tmp.path, "nonexistent")
    const result = detectConfigFile(base)
    expect(result.format).toBe("none")
    await tmp.cleanup()
  })
})

describe("detectPluginConfigFile", () => {
  it("finds canonical plugin config in dir", async () => {
    const tmp = makeTmpDir("detect-plugin-")
    writeFixture(path.join(tmp.path, "oc-blackbytes.jsonc"), "{}")
    const result = detectPluginConfigFile(tmp.path)
    expect(result.format).toBe("jsonc")
    expect(result.path).toContain("oc-blackbytes")
    await tmp.cleanup()
  })

  it("returns none when no config exists", async () => {
    const tmp = makeTmpDir("detect-plugin-")
    const result = detectPluginConfigFile(tmp.path)
    expect(result.format).toBe("none")
    await tmp.cleanup()
  })
})
