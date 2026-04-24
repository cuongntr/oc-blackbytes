import { describe, expect, it } from "bun:test"
import { createWebsearchConfig } from "../../src/extensions/mcp/websearch"
import { withEnv } from "../helpers/env"

describe("createWebsearchConfig — Exa provider", () => {
  it("returns Exa config without api key when provider is 'exa'", () => {
    const result = createWebsearchConfig({ provider: "exa" })
    expect(result).toBeDefined()
    expect(result?.type).toBe("remote")
    expect(result?.url).toContain("mcp.exa.ai")
    expect(result?.enabled).toBe(true)
    expect(result?.oauth).toBe(false)
  })

  it("includes EXA_API_KEY in URL when set via env", async () => {
    await withEnv({ EXA_API_KEY: "test-exa-key-123", TAVILY_API_KEY: undefined }, () => {
      const result = createWebsearchConfig({ provider: "exa" })
      expect(result).toBeDefined()
      expect(result?.url).toContain("test-exa-key-123")
    })
  })

  it("returns basic Exa URL when EXA_API_KEY is not set", async () => {
    await withEnv({ EXA_API_KEY: undefined }, () => {
      const result = createWebsearchConfig({ provider: "exa" })
      expect(result).toBeDefined()
      expect(result?.url).toBe("https://mcp.exa.ai/mcp?tools=web_search_exa")
    })
  })

  it("EXA_API_KEY in URL equals key byte-for-byte (URL-encoded)", async () => {
    const apiKey = "my-special-key!@#"
    await withEnv({ EXA_API_KEY: apiKey }, () => {
      const result = createWebsearchConfig({ provider: "exa" })
      expect(result?.url).toContain(encodeURIComponent(apiKey))
    })
  })
})

describe("createWebsearchConfig — Tavily provider", () => {
  it("returns Tavily config when provider is 'tavily' and TAVILY_API_KEY is set", async () => {
    await withEnv({ TAVILY_API_KEY: "test-tavily-key" }, () => {
      const result = createWebsearchConfig({ provider: "tavily" })
      expect(result).toBeDefined()
      expect(result?.type).toBe("remote")
      expect(result?.url).toContain("mcp.tavily.com")
      expect(result?.enabled).toBe(true)
      expect(result?.oauth).toBe(false)
    })
  })

  it("Tavily Authorization header contains the API key", async () => {
    await withEnv({ TAVILY_API_KEY: "test-tavily-key" }, () => {
      const result = createWebsearchConfig({ provider: "tavily" }) as {
        headers?: Record<string, string>
      }
      expect(result?.headers?.Authorization).toBe("Bearer test-tavily-key")
    })
  })

  it("returns undefined when provider is 'tavily' but TAVILY_API_KEY is not set", async () => {
    await withEnv({ TAVILY_API_KEY: undefined }, () => {
      const result = createWebsearchConfig({ provider: "tavily" })
      expect(result).toBeUndefined()
    })
  })

  it("config-sourced key and env-sourced key produce the same header", async () => {
    const key = "same-key-abc"
    await withEnv({ TAVILY_API_KEY: key }, () => {
      const result = createWebsearchConfig({ provider: "tavily" }) as {
        headers?: Record<string, string>
      }
      expect(result?.headers?.Authorization).toBe(`Bearer ${key}`)
    })
  })
})

describe("createWebsearchConfig — defaults and disabled paths", () => {
  it("defaults to exa when no provider specified", async () => {
    await withEnv({ EXA_API_KEY: undefined }, () => {
      const result = createWebsearchConfig({})
      expect(result).toBeDefined()
      expect(result?.url).toContain("mcp.exa.ai")
    })
  })

  it("defaults to exa when config is undefined", async () => {
    await withEnv({ EXA_API_KEY: undefined }, () => {
      const result = createWebsearchConfig(undefined)
      expect(result).toBeDefined()
      expect(result?.url).toContain("mcp.exa.ai")
    })
  })
})
