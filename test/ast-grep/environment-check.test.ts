import { describe, expect, it } from "bun:test"
import {
  checkEnvironment,
  formatEnvironmentCheck,
} from "../../src/extensions/tools/ast-grep/environment-check"

describe("checkEnvironment", () => {
  it("returns an object with cli and napi fields", () => {
    const result = checkEnvironment()
    expect(result).toHaveProperty("cli")
    expect(result).toHaveProperty("napi")
  })

  it("cli field has available (boolean) and path (string)", () => {
    const result = checkEnvironment()
    expect(typeof result.cli.available).toBe("boolean")
    expect(typeof result.cli.path).toBe("string")
  })

  it("napi field has available boolean", () => {
    const result = checkEnvironment()
    expect(typeof result.napi.available).toBe("boolean")
  })

  it("cli.path is 'not found' when binary is absent", () => {
    // In a CI environment without ast-grep CLI installed, path should indicate not found
    const result = checkEnvironment()
    // Either it's available (with a real path) or it reports 'not found' / an error path
    if (!result.cli.available) {
      expect(result.cli.path).toMatch(/not found|\//)
    } else {
      expect(result.cli.path.length).toBeGreaterThan(0)
    }
  })

  it("cli.error is set when binary is not available", () => {
    const result = checkEnvironment()
    if (!result.cli.available) {
      expect(result.cli.error).toBeDefined()
      expect(typeof result.cli.error).toBe("string")
    }
  })

  it("napi.error is set when napi is not available", () => {
    const result = checkEnvironment()
    if (!result.napi.available) {
      expect(result.napi.error).toBeDefined()
      expect(typeof result.napi.error).toBe("string")
    }
  })
})

describe("formatEnvironmentCheck", () => {
  it("returns a non-empty string", () => {
    const result = checkEnvironment()
    const formatted = formatEnvironmentCheck(result)
    expect(typeof formatted).toBe("string")
    expect(formatted.length).toBeGreaterThan(0)
  })

  it("includes 'ast-grep Environment Status' header", () => {
    const result = checkEnvironment()
    const formatted = formatEnvironmentCheck(result)
    expect(formatted).toContain("ast-grep Environment Status")
  })

  it("mentions CLI status", () => {
    const result = checkEnvironment()
    const formatted = formatEnvironmentCheck(result)
    expect(formatted).toContain("CLI")
  })

  it("mentions NAPI status", () => {
    const result = checkEnvironment()
    const formatted = formatEnvironmentCheck(result)
    expect(formatted).toContain("NAPI")
  })

  it("shows [OK] CLI when cli is available", () => {
    const formatted = formatEnvironmentCheck({
      cli: { available: true, path: "/usr/bin/sg" },
      napi: { available: false, error: "not installed" },
    })
    expect(formatted).toContain("[OK] CLI")
  })

  it("shows [X] CLI when cli is not available", () => {
    const formatted = formatEnvironmentCheck({
      cli: { available: false, path: "not found", error: "binary not found" },
      napi: { available: false },
    })
    expect(formatted).toContain("[X] CLI")
  })

  it("shows [OK] NAPI when napi is available", () => {
    const formatted = formatEnvironmentCheck({
      cli: { available: false, path: "not found" },
      napi: { available: true },
    })
    expect(formatted).toContain("[OK] NAPI")
  })

  it("shows language counts", () => {
    const result = checkEnvironment()
    const formatted = formatEnvironmentCheck(result)
    expect(formatted).toMatch(/CLI supports \d+ languages/)
    expect(formatted).toMatch(/NAPI supports \d+ languages/)
  })
})
