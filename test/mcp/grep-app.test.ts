import { describe, expect, it } from "bun:test"
import { grep_app } from "../../src/extensions/mcp/grep-app"

describe("grep_app MCP constant", () => {
  it("is defined", () => {
    expect(grep_app).toBeDefined()
  })

  it("has type 'remote'", () => {
    expect(grep_app.type).toBe("remote")
  })

  it("has the correct URL", () => {
    expect(grep_app.url).toBe("https://mcp.grep.app")
  })

  it("is enabled", () => {
    expect(grep_app.enabled).toBe(true)
  })

  it("oauth is false", () => {
    expect(grep_app.oauth).toBe(false)
  })
})

describe("grep_app full shape pinning", () => {
  it("exact shape matches expected literal", () => {
    expect(grep_app).toEqual({
      type: "remote",
      url: "https://mcp.grep.app",
      enabled: true,
      oauth: false,
    })
  })

  it("does not have extra unexpected keys", () => {
    const keys = Object.keys(grep_app)
    expect(keys.sort()).toEqual(["enabled", "oauth", "type", "url"])
  })
})
