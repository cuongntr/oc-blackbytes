import { describe, expect, it } from "bun:test"
import { AnyMcpNameSchema, McpNameSchema } from "../../../src/config/schema/mcp"
import {
  WebsearchConfigSchema,
  WebsearchProviderSchema,
} from "../../../src/config/schema/websearch"

describe("McpNameSchema", () => {
  it("accepts 'websearch'", () => {
    expect(McpNameSchema.safeParse("websearch").success).toBe(true)
  })

  it("accepts 'context7'", () => {
    expect(McpNameSchema.safeParse("context7").success).toBe(true)
  })

  it("accepts 'grep_app'", () => {
    expect(McpNameSchema.safeParse("grep_app").success).toBe(true)
  })

  it("rejects unknown MCP name", () => {
    expect(McpNameSchema.safeParse("unknown").success).toBe(false)
  })

  it("rejects empty string", () => {
    expect(McpNameSchema.safeParse("").success).toBe(false)
  })
})

describe("AnyMcpNameSchema", () => {
  it("accepts known MCP names", () => {
    expect(AnyMcpNameSchema.safeParse("websearch").success).toBe(true)
    expect(AnyMcpNameSchema.safeParse("context7").success).toBe(true)
  })

  it("accepts custom MCP names", () => {
    expect(AnyMcpNameSchema.safeParse("my-custom-mcp").success).toBe(true)
  })

  it("rejects empty string", () => {
    expect(AnyMcpNameSchema.safeParse("").success).toBe(false)
  })
})

describe("WebsearchProviderSchema", () => {
  it("accepts 'exa'", () => {
    expect(WebsearchProviderSchema.safeParse("exa").success).toBe(true)
  })

  it("accepts 'tavily'", () => {
    expect(WebsearchProviderSchema.safeParse("tavily").success).toBe(true)
  })

  it("rejects unknown provider", () => {
    expect(WebsearchProviderSchema.safeParse("bing").success).toBe(false)
  })
})

describe("WebsearchConfigSchema", () => {
  it("accepts empty object (all optional)", () => {
    expect(WebsearchConfigSchema.safeParse({}).success).toBe(true)
  })

  it("accepts valid provider", () => {
    expect(WebsearchConfigSchema.safeParse({ provider: "exa" }).success).toBe(true)
    expect(WebsearchConfigSchema.safeParse({ provider: "tavily" }).success).toBe(true)
  })

  it("rejects invalid provider", () => {
    expect(WebsearchConfigSchema.safeParse({ provider: "google" }).success).toBe(false)
  })

  it("parses provider correctly", () => {
    const result = WebsearchConfigSchema.parse({ provider: "exa" })
    expect(result.provider).toBe("exa")
  })
})
