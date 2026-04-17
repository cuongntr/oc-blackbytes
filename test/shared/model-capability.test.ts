import { describe, expect, it } from "bun:test"
import { detectModelFamily, resolveModelSettings } from "../../src/shared/model-capability"

/**
 * Tests for shared/model-capability.ts:
 * - detectModelFamily: provider ID match, pattern match, unknown fallback
 * - resolveModelSettings: Claude thinking, OpenAI reasoning effort, gemini/other no-op
 *
 * Every known family covered: claude, openai, gemini, other
 */

// ---------------------------------------------------------------------------
// detectModelFamily
// ---------------------------------------------------------------------------

describe("detectModelFamily", () => {
  describe("claude family", () => {
    it("detects claude family via anthropic provider ID", () => {
      expect(detectModelFamily("anthropic", "claude-sonnet-4-6")).toBe("claude")
    })

    it("detects claude family via model pattern when provider is github-copilot", () => {
      expect(detectModelFamily("github-copilot", "claude-opus-4-7-20260101")).toBe("claude")
    })

    it("detects claude family via claude prefix pattern", () => {
      expect(detectModelFamily("unknown-provider", "claude-haiku-4-5")).toBe("claude")
    })
  })

  describe("openai family", () => {
    it("detects openai family via openai provider ID", () => {
      expect(detectModelFamily("openai", "gpt-5.4")).toBe("openai")
    })

    it("detects openai family via gpt- pattern for proxy providers", () => {
      expect(detectModelFamily("github-copilot", "gpt-5.4-mini")).toBe("openai")
    })

    it("detects openai family via o-digit pattern (e.g., o1, o3)", () => {
      expect(detectModelFamily("github-copilot", "o3")).toBe("openai")
    })

    it("detects openai family via o-digit pattern with suffix (e.g., o1-mini)", () => {
      expect(detectModelFamily("github-copilot", "o1-mini")).toBe("openai")
    })
  })

  describe("gemini family", () => {
    it("detects gemini family via google provider ID", () => {
      expect(detectModelFamily("google", "gemini-3.1-pro")).toBe("gemini")
    })

    it("detects gemini family via google-vertex provider ID", () => {
      expect(detectModelFamily("google-vertex", "gemini-3-flash")).toBe("gemini")
    })

    it("detects gemini family via gemini- pattern", () => {
      expect(detectModelFamily("unknown", "gemini-3.1-pro")).toBe("gemini")
    })
  })

  describe("other family (unknown models)", () => {
    it("returns 'other' for completely unknown provider and model", () => {
      expect(detectModelFamily("custom-provider", "my-private-model")).toBe("other")
    })

    it("returns 'other' for minimax models", () => {
      expect(detectModelFamily("minimax", "minimax-m2.7")).toBe("other")
    })

    it("returns 'other' for kimi models", () => {
      expect(detectModelFamily("kimi", "kimi-k2.5")).toBe("other")
    })
  })
})

// ---------------------------------------------------------------------------
// resolveModelSettings
// ---------------------------------------------------------------------------

describe("resolveModelSettings", () => {
  describe("claude family", () => {
    it("sets adaptive thinking for modern claude models with reasoning-capable agents", () => {
      const result = resolveModelSettings({
        family: "claude",
        agentName: "bytes",
        modelRef: "anthropic/claude-sonnet-4-6",
        supportsReasoning: true,
      })

      expect(result.thinking).toBeDefined()
      expect(result.thinking?.type).toBe("adaptive")
      expect(result.reasoningEffort).toBeUndefined()
      expect(result.changes).toHaveLength(0)
    })

    it("sets enabled thinking with budgetTokens for older claude models (haiku)", () => {
      const result = resolveModelSettings({
        family: "claude",
        agentName: "bytes",
        modelRef: "anthropic/claude-haiku-4-5",
        supportsReasoning: true,
      })

      expect(result.thinking?.type).toBe("enabled")
      expect(result.thinking?.budgetTokens).toBeDefined()
      expect(result.thinking?.budgetTokens).toBeGreaterThan(0)
    })

    it("sets enabled thinking for claude 3.x models", () => {
      const result = resolveModelSettings({
        family: "claude",
        agentName: "oracle",
        modelRef: "anthropic/claude-3-5-sonnet",
        supportsReasoning: true,
      })

      expect(result.thinking?.type).toBe("enabled")
    })

    it("sets no thinking when agent has no configured budget (e.g., explore)", () => {
      const result = resolveModelSettings({
        family: "claude",
        agentName: "explore",
        modelRef: "anthropic/claude-haiku-4-5",
        supportsReasoning: true,
      })

      // explore is not in CLAUDE_THINKING_BUDGET → no thinking set
      expect(result.thinking).toBeUndefined()
    })

    it("sets no thinking when supportsReasoning is false", () => {
      const result = resolveModelSettings({
        family: "claude",
        agentName: "bytes",
        modelRef: "anthropic/claude-sonnet-4-6",
        supportsReasoning: false,
      })

      expect(result.thinking).toBeUndefined()
      expect(result.reasoningEffort).toBeUndefined()
    })

    it("never sets reasoningEffort for claude models", () => {
      const result = resolveModelSettings({
        family: "claude",
        agentName: "bytes",
        modelRef: "anthropic/claude-sonnet-4-6",
        supportsReasoning: true,
        userReasoningEffort: "high",
      })

      expect(result.reasoningEffort).toBeUndefined()
    })
  })

  describe("openai family", () => {
    it("sets reasoningEffort from default for reasoning-capable agents (bytes → medium)", () => {
      const result = resolveModelSettings({
        family: "openai",
        agentName: "bytes",
        modelRef: "openai/gpt-5.4",
        supportsReasoning: true,
      })

      expect(result.reasoningEffort).toBe("medium")
      expect(result.thinking).toBeUndefined()
      expect(result.changes).toHaveLength(0)
    })

    it("sets reasoningEffort to high for oracle agent default", () => {
      const result = resolveModelSettings({
        family: "openai",
        agentName: "oracle",
        modelRef: "openai/gpt-5.4",
        supportsReasoning: true,
      })

      expect(result.reasoningEffort).toBe("high")
    })

    it("uses user-provided reasoningEffort when specified and valid", () => {
      const result = resolveModelSettings({
        family: "openai",
        agentName: "bytes",
        modelRef: "openai/gpt-5.4",
        supportsReasoning: true,
        userReasoningEffort: "low",
      })

      expect(result.reasoningEffort).toBe("low")
      expect(result.changes).toHaveLength(0)
    })

    it("does not set reasoningEffort when supportsReasoning is false", () => {
      const result = resolveModelSettings({
        family: "openai",
        agentName: "bytes",
        modelRef: "openai/gpt-5.4",
        supportsReasoning: false,
      })

      expect(result.reasoningEffort).toBeUndefined()
    })

    it("does not set reasoningEffort for agents with no default (e.g., librarian)", () => {
      const result = resolveModelSettings({
        family: "openai",
        agentName: "librarian",
        modelRef: "openai/gpt-5-nano",
        supportsReasoning: true,
      })

      // librarian not in OPENAI_REASONING_DEFAULTS → no desired value → no reasoningEffort set
      expect(result.reasoningEffort).toBeUndefined()
    })
  })

  describe("gemini family", () => {
    it("returns no thinking and no reasoningEffort for gemini models", () => {
      const result = resolveModelSettings({
        family: "gemini",
        agentName: "bytes",
        modelRef: "google/gemini-3.1-pro",
        supportsReasoning: true,
      })

      expect(result.thinking).toBeUndefined()
      expect(result.reasoningEffort).toBeUndefined()
      expect(result.changes).toHaveLength(0)
    })

    it("returns empty result regardless of supportsReasoning for gemini", () => {
      const result = resolveModelSettings({
        family: "gemini",
        agentName: "oracle",
        modelRef: "google/gemini-3.1-pro",
        supportsReasoning: false,
      })

      expect(result.thinking).toBeUndefined()
      expect(result.reasoningEffort).toBeUndefined()
    })
  })

  describe("other family (unknown models)", () => {
    it("returns no thinking and no reasoningEffort for unknown model families", () => {
      const result = resolveModelSettings({
        family: "other",
        agentName: "bytes",
        modelRef: "kimi/kimi-k2.5",
        supportsReasoning: true,
      })

      expect(result.thinking).toBeUndefined()
      expect(result.reasoningEffort).toBeUndefined()
      expect(result.changes).toHaveLength(0)
    })
  })

  describe("changes tracking", () => {
    it("records no changes when settings are directly applied", () => {
      const result = resolveModelSettings({
        family: "claude",
        agentName: "bytes",
        modelRef: "anthropic/claude-sonnet-4-6",
        supportsReasoning: true,
      })

      expect(result.changes).toHaveLength(0)
    })
  })
})
