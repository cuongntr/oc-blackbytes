import { describe, expect, it } from "bun:test"
import {
  BUILTIN_FALLBACK_CHAINS,
  type FallbackChainEntry,
} from "../../src/services/model-requirements"

/**
 * Tests for model-requirements.ts:
 * - BUILTIN_FALLBACK_CHAINS structure per agent
 * - FallbackChainEntry shape (model prefix, providers, optional overrides)
 * - Coverage: oracle, explore, librarian, general
 * - bytes is NOT in the builtin chain (intentionally absent)
 */

describe("model-requirements — BUILTIN_FALLBACK_CHAINS", () => {
  it("exports BUILTIN_FALLBACK_CHAINS as a non-empty object", () => {
    expect(typeof BUILTIN_FALLBACK_CHAINS).toBe("object")
    expect(Object.keys(BUILTIN_FALLBACK_CHAINS).length).toBeGreaterThan(0)
  })

  it("does not include a chain for 'bytes' (bytes respects user's UI selection)", () => {
    expect(BUILTIN_FALLBACK_CHAINS.bytes).toBeUndefined()
  })

  describe("oracle chain", () => {
    let chain: FallbackChainEntry[]

    it("has an oracle chain with at least one entry", () => {
      chain = BUILTIN_FALLBACK_CHAINS.oracle
      expect(Array.isArray(chain)).toBe(true)
      expect(chain.length).toBeGreaterThanOrEqual(1)
    })

    it("oracle chain entries all have model prefix and providers array", () => {
      for (const entry of BUILTIN_FALLBACK_CHAINS.oracle) {
        expect(typeof entry.model).toBe("string")
        expect(entry.model.length).toBeGreaterThan(0)
        expect(Array.isArray(entry.providers)).toBe(true)
        expect(entry.providers.length).toBeGreaterThan(0)
      }
    })

    it("oracle chain first entry has reasoningEffort set (high-capability requirement)", () => {
      const first = BUILTIN_FALLBACK_CHAINS.oracle[0]
      expect(first.reasoningEffort).toBeDefined()
    })

    it("oracle chain does not include anthropic as first provider (cross-provider diversity)", () => {
      const first = BUILTIN_FALLBACK_CHAINS.oracle[0]
      // Design: OpenAI first to differ from typical Claude primary
      expect(first.providers[0]).not.toBe("anthropic")
    })
  })

  describe("explore chain", () => {
    it("has an explore chain with at least one entry", () => {
      const chain = BUILTIN_FALLBACK_CHAINS.explore
      expect(Array.isArray(chain)).toBe(true)
      expect(chain.length).toBeGreaterThanOrEqual(1)
    })

    it("explore chain entries have temperature set (low for deterministic search)", () => {
      for (const entry of BUILTIN_FALLBACK_CHAINS.explore) {
        expect(entry.temperature).toBeDefined()
        expect(entry.temperature).toBeLessThanOrEqual(0.2)
      }
    })

    it("explore chain entries have model prefix and providers", () => {
      for (const entry of BUILTIN_FALLBACK_CHAINS.explore) {
        expect(typeof entry.model).toBe("string")
        expect(entry.model.length).toBeGreaterThan(0)
        expect(Array.isArray(entry.providers)).toBe(true)
      }
    })
  })

  describe("librarian chain", () => {
    it("has a librarian chain with at least one entry", () => {
      const chain = BUILTIN_FALLBACK_CHAINS.librarian
      expect(Array.isArray(chain)).toBe(true)
      expect(chain.length).toBeGreaterThanOrEqual(1)
    })

    it("librarian chain entries have temperature set (cheap but research-capable)", () => {
      for (const entry of BUILTIN_FALLBACK_CHAINS.librarian) {
        expect(entry.temperature).toBeDefined()
      }
    })

    it("librarian chain entries have valid model and providers", () => {
      for (const entry of BUILTIN_FALLBACK_CHAINS.librarian) {
        expect(typeof entry.model).toBe("string")
        expect(entry.model.length).toBeGreaterThan(0)
        expect(entry.providers.length).toBeGreaterThan(0)
      }
    })
  })

  describe("general chain", () => {
    it("has a general chain with at least one entry", () => {
      const chain = BUILTIN_FALLBACK_CHAINS.general
      expect(Array.isArray(chain)).toBe(true)
      expect(chain.length).toBeGreaterThanOrEqual(1)
    })

    it("general chain entries have model prefix and providers (mid-tier coding models)", () => {
      for (const entry of BUILTIN_FALLBACK_CHAINS.general) {
        expect(typeof entry.model).toBe("string")
        expect(entry.model.length).toBeGreaterThan(0)
        expect(Array.isArray(entry.providers)).toBe(true)
        expect(entry.providers.length).toBeGreaterThan(0)
      }
    })

    it("general chain has anthropic/github-copilot as one of the provider options", () => {
      const chain = BUILTIN_FALLBACK_CHAINS.general
      const hasAnthropic = chain.some(
        (e) => e.providers.includes("anthropic") || e.providers.includes("github-copilot"),
      )
      expect(hasAnthropic).toBe(true)
    })
  })

  describe("FallbackChainEntry shape validation", () => {
    it("all entries across all chains conform to FallbackChainEntry shape", () => {
      for (const [agentName, chain] of Object.entries(BUILTIN_FALLBACK_CHAINS)) {
        for (const entry of chain) {
          // Required fields
          expect(typeof entry.model, `${agentName}: model must be string`).toBe("string")
          expect(Array.isArray(entry.providers), `${agentName}: providers must be array`).toBe(true)
          // Optional fields — if present, must be correct type
          if (entry.reasoningEffort !== undefined) {
            expect(
              typeof entry.reasoningEffort,
              `${agentName}: reasoningEffort must be string`,
            ).toBe("string")
          }
          if (entry.temperature !== undefined) {
            expect(typeof entry.temperature, `${agentName}: temperature must be number`).toBe(
              "number",
            )
          }
        }
      }
    })

    it("all provider IDs in all chains are non-empty strings", () => {
      for (const [agentName, chain] of Object.entries(BUILTIN_FALLBACK_CHAINS)) {
        for (const entry of chain) {
          for (const provider of entry.providers) {
            expect(
              typeof provider === "string" && provider.length > 0,
              `${agentName}: provider ID "${provider}" must be non-empty string`,
            ).toBe(true)
          }
        }
      }
    })
  })
})
