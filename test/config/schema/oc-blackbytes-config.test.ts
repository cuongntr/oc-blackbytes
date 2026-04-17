import { describe, expect, it } from "bun:test"
import {
  AgentModelConfigSchema,
  FallbackModelObjectSchema,
  FallbackModelsSchema,
  OcBlackbytesConfigSchema,
} from "../../../src/config/schema/oc-blackbytes-config"

describe("OcBlackbytesConfigSchema", () => {
  describe("empty / defaults", () => {
    it("parses empty object with no errors", () => {
      const result = OcBlackbytesConfigSchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({})
      }
    })

    it("all fields are optional", () => {
      expect(OcBlackbytesConfigSchema.parse({})).toEqual({})
    })
  })

  describe("$schema field", () => {
    it("accepts a string $schema", () => {
      const result = OcBlackbytesConfigSchema.safeParse({
        $schema: "https://example.com/schema.json",
      })
      expect(result.success).toBe(true)
    })

    it("rejects a non-string $schema", () => {
      const result = OcBlackbytesConfigSchema.safeParse({ $schema: 123 })
      expect(result.success).toBe(false)
    })
  })

  describe("disabled_mcps", () => {
    it("accepts an array of strings", () => {
      const result = OcBlackbytesConfigSchema.safeParse({
        disabled_mcps: ["websearch", "context7"],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.disabled_mcps).toEqual(["websearch", "context7"])
      }
    })

    it("rejects non-string items", () => {
      const result = OcBlackbytesConfigSchema.safeParse({ disabled_mcps: [123] })
      expect(result.success).toBe(false)
    })

    it("rejects empty string items", () => {
      const result = OcBlackbytesConfigSchema.safeParse({ disabled_mcps: [""] })
      expect(result.success).toBe(false)
    })

    it("accepts empty array", () => {
      const result = OcBlackbytesConfigSchema.safeParse({ disabled_mcps: [] })
      expect(result.success).toBe(true)
    })
  })

  describe("disabled_agents", () => {
    it("accepts an array of agent name strings", () => {
      const result = OcBlackbytesConfigSchema.safeParse({
        disabled_agents: ["oracle", "explore"],
      })
      expect(result.success).toBe(true)
    })

    it("rejects non-array", () => {
      const result = OcBlackbytesConfigSchema.safeParse({ disabled_agents: "oracle" })
      expect(result.success).toBe(false)
    })
  })

  describe("disabled_tools", () => {
    it("accepts an array of tool name strings", () => {
      const result = OcBlackbytesConfigSchema.safeParse({
        disabled_tools: ["hashline_edit", "glob"],
      })
      expect(result.success).toBe(true)
    })

    it("rejects non-array", () => {
      const result = OcBlackbytesConfigSchema.safeParse({ disabled_tools: "glob" })
      expect(result.success).toBe(false)
    })
  })

  describe("hashline_edit", () => {
    it("accepts true", () => {
      const result = OcBlackbytesConfigSchema.safeParse({ hashline_edit: true })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.hashline_edit).toBe(true)
    })

    it("accepts false", () => {
      const result = OcBlackbytesConfigSchema.safeParse({ hashline_edit: false })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.hashline_edit).toBe(false)
    })

    it("rejects string value", () => {
      const result = OcBlackbytesConfigSchema.safeParse({ hashline_edit: "yes" })
      expect(result.success).toBe(false)
    })

    it("rejects numeric value", () => {
      const result = OcBlackbytesConfigSchema.safeParse({ hashline_edit: 1 })
      expect(result.success).toBe(false)
    })
  })

  describe("model_fallback", () => {
    it("accepts boolean", () => {
      const result = OcBlackbytesConfigSchema.safeParse({ model_fallback: true })
      expect(result.success).toBe(true)
    })

    it("rejects string", () => {
      const result = OcBlackbytesConfigSchema.safeParse({ model_fallback: "true" })
      expect(result.success).toBe(false)
    })
  })

  describe("websearch", () => {
    it("accepts websearch with provider exa", () => {
      const result = OcBlackbytesConfigSchema.safeParse({
        websearch: { provider: "exa" },
      })
      expect(result.success).toBe(true)
    })

    it("accepts websearch with provider tavily", () => {
      const result = OcBlackbytesConfigSchema.safeParse({
        websearch: { provider: "tavily" },
      })
      expect(result.success).toBe(true)
    })

    it("rejects websearch with invalid provider", () => {
      const result = OcBlackbytesConfigSchema.safeParse({
        websearch: { provider: "bing" },
      })
      expect(result.success).toBe(false)
    })

    it("accepts websearch without provider (optional)", () => {
      const result = OcBlackbytesConfigSchema.safeParse({ websearch: {} })
      expect(result.success).toBe(true)
    })
  })

  describe("agents — per-agent model overrides", () => {
    it("accepts a record of agent model configs", () => {
      const result = OcBlackbytesConfigSchema.safeParse({
        agents: {
          oracle: { model: "openai/gpt-4o", reasoningEffort: "high" },
          explore: { model: "google/gemini-flash" },
        },
      })
      expect(result.success).toBe(true)
    })

    it("accepts empty agents record", () => {
      const result = OcBlackbytesConfigSchema.safeParse({ agents: {} })
      expect(result.success).toBe(true)
    })

    it("rejects agent config with invalid temperature", () => {
      const result = OcBlackbytesConfigSchema.safeParse({
        agents: { oracle: { temperature: "hot" } },
      })
      expect(result.success).toBe(false)
    })

    it("accepts agent config with all optional fields", () => {
      const result = OcBlackbytesConfigSchema.safeParse({
        agents: {
          bytes: {
            model: "anthropic/claude-sonnet-4-6",
            reasoningEffort: "medium",
            temperature: 0.7,
            fallback_models: ["openai/gpt-4o"],
          },
        },
      })
      expect(result.success).toBe(true)
    })
  })

  describe("fallback_models", () => {
    it("accepts a single string", () => {
      const result = OcBlackbytesConfigSchema.safeParse({
        fallback_models: "openai/gpt-4o",
      })
      expect(result.success).toBe(true)
    })

    it("accepts an array of strings", () => {
      const result = OcBlackbytesConfigSchema.safeParse({
        fallback_models: ["openai/gpt-4o", "google/gemini-flash"],
      })
      expect(result.success).toBe(true)
    })

    it("accepts an array of objects with model key", () => {
      const result = OcBlackbytesConfigSchema.safeParse({
        fallback_models: [{ model: "openai/gpt-4o", reasoningEffort: "high" }],
      })
      expect(result.success).toBe(true)
    })

    it("accepts mixed array of strings and objects", () => {
      const result = OcBlackbytesConfigSchema.safeParse({
        fallback_models: ["openai/gpt-4o", { model: "google/gemini-flash", temperature: 0.5 }],
      })
      expect(result.success).toBe(true)
    })

    it("rejects numeric fallback model", () => {
      const result = OcBlackbytesConfigSchema.safeParse({ fallback_models: 42 })
      expect(result.success).toBe(false)
    })
  })

  describe("safeParse failure — error shape", () => {
    it("safeParse failure includes issues array", () => {
      const result = OcBlackbytesConfigSchema.safeParse({ hashline_edit: "yes" })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(Array.isArray(result.error.issues)).toBe(true)
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })

    it("issues include path for nested errors", () => {
      const result = OcBlackbytesConfigSchema.safeParse({
        agents: { oracle: { temperature: "hot" } },
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join("."))
        expect(paths.some((p) => p.includes("temperature"))).toBe(true)
      }
    })
  })
})

describe("AgentModelConfigSchema", () => {
  it("parses empty object", () => {
    expect(AgentModelConfigSchema.parse({})).toEqual({})
  })

  it("parses all optional fields", () => {
    const input = {
      model: "openai/gpt-4o",
      reasoningEffort: "high",
      temperature: 0.5,
      fallback_models: ["google/gemini-flash"],
    }
    expect(AgentModelConfigSchema.parse(input)).toEqual(input)
  })

  it("rejects invalid temperature type", () => {
    const result = AgentModelConfigSchema.safeParse({ temperature: "warm" })
    expect(result.success).toBe(false)
  })
})

describe("FallbackModelObjectSchema", () => {
  it("requires model field", () => {
    const result = FallbackModelObjectSchema.safeParse({ reasoningEffort: "high" })
    expect(result.success).toBe(false)
  })

  it("accepts model with optional fields", () => {
    const result = FallbackModelObjectSchema.safeParse({
      model: "openai/gpt-4o",
      reasoningEffort: "low",
      temperature: 0.3,
    })
    expect(result.success).toBe(true)
  })
})

describe("FallbackModelsSchema", () => {
  it("accepts single string", () => {
    expect(FallbackModelsSchema.parse("openai/gpt-4o")).toBe("openai/gpt-4o")
  })

  it("accepts array of strings", () => {
    const arr = ["model-a", "model-b"]
    expect(FallbackModelsSchema.parse(arr)).toEqual(arr)
  })

  it("accepts array of objects", () => {
    const arr = [{ model: "model-a" }]
    expect(FallbackModelsSchema.parse(arr)).toEqual(arr)
  })

  it("rejects number", () => {
    const result = FallbackModelsSchema.safeParse(99)
    expect(result.success).toBe(false)
  })
})
