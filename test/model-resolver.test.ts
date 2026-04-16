import { describe, expect, it } from "bun:test"
import type { OcBlackbytesConfig } from "../src/config/schema/oc-blackbytes-config"
import { resolveAllAgentModels } from "../src/services"

function createConfig(overrides: Partial<OcBlackbytesConfig>): OcBlackbytesConfig {
  return overrides as OcBlackbytesConfig
}

describe("model resolver", () => {
  it("normalizes a configured primary model to the discovered model id", () => {
    const resolved = resolveAllAgentModels(
      createConfig({
        agents: {
          general: { model: "anthropic/claude-sonnet-4-6" },
        },
      }),
      new Map([["anthropic", new Set(["claude-sonnet-4-6-20260401"])]]),
    )

    expect(resolved?.general?.model).toBe("anthropic/claude-sonnet-4-6-20260401")
  })

  it("falls back when the configured model is missing on a connected provider", () => {
    const resolved = resolveAllAgentModels(
      createConfig({
        agents: {
          oracle: { model: "openai/gpt-5.4" },
        },
      }),
      new Map([
        ["openai", new Set(["gpt-5.4-mini"])],
        ["anthropic", new Set(["claude-opus-4-6-20260401"])],
      ]),
    )

    expect(resolved?.oracle?.model).toBe("anthropic/claude-opus-4-6-20260401")
  })

  it("normalizes per-agent fallback models and applies fallback overrides", () => {
    const resolved = resolveAllAgentModels(
      createConfig({
        agents: {
          general: {
            model: "openai/gpt-5.4-mini",
            fallback_models: [
              {
                model: "anthropic/claude-sonnet-4-6",
                reasoningEffort: "high",
                temperature: 0.2,
              },
            ],
          },
        },
      }),
      new Map([
        ["openai", new Set(["gpt-5.4-nano"])],
        ["anthropic", new Set(["claude-sonnet-4-6-20260401"])],
      ]),
    )

    expect(resolved?.general?.model).toBe("anthropic/claude-sonnet-4-6-20260401")
    expect(resolved?.general?.reasoningEffort).toBe("high")
    expect(resolved?.general?.temperature).toBe(0.2)
  })
})
