import { describe, expect, it } from "bun:test"
import { context7 } from "../../src/extensions/mcp/context7"
import { withEnv } from "../helpers/env"

describe("context7 MCP constant", () => {
  it("is defined", () => {
    expect(context7).toBeDefined()
  })

  it("has type 'remote'", () => {
    expect(context7.type).toBe("remote")
  })

  it("has the correct URL", () => {
    expect(context7.url).toBe("https://mcp.context7.com/mcp")
  })

  it("is enabled", () => {
    expect(context7.enabled).toBe(true)
  })

  it("oauth is false", () => {
    expect(context7.oauth).toBe(false)
  })

  it("has headers undefined when CONTEXT7_API_KEY is not set", async () => {
    // The module-level constant is evaluated at import time.
    // We test the factory behavior by importing fresh.
    // Since the constant is already imported, we verify its current shape.
    // If CONTEXT7_API_KEY was not set at import time, headers should be undefined.
    if (!process.env.CONTEXT7_API_KEY) {
      expect(context7.headers).toBeUndefined()
    } else {
      expect(context7.headers).toBeDefined()
    }
  })
})

describe("context7 full shape pinning", () => {
  it("only has the expected keys (type, url, enabled, headers, oauth)", () => {
    const keys = Object.keys(context7)
    for (const key of keys) {
      expect(["type", "url", "enabled", "headers", "oauth"]).toContain(key)
    }
  })

  it("url is exactly https://mcp.context7.com/mcp", () => {
    expect(context7.url).toBe("https://mcp.context7.com/mcp")
  })
})
