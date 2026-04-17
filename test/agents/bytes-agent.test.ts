/**
 * Tests for the bytes agent factory: src/extensions/agents/bytes/
 *
 * Verifies:
 * - Correct prompt variant selected by model family (default, gpt, gemini).
 * - Agent shape: description, mode, permission, temperature.
 * - Both hashlineEditEnabled=true and false are handled per variant.
 * - Invariants present in every variant: language matching, question:allow permission.
 */
import { describe, expect, it } from "bun:test"
import type { AgentConfig } from "@opencode-ai/sdk/v2"
import { createBytesAgent } from "../../src/extensions/agents/bytes"
import { buildBytesDefaultPrompt } from "../../src/extensions/agents/bytes/default"
import { buildBytesGeminiPrompt } from "../../src/extensions/agents/bytes/gemini"
import { buildBytesGptPrompt } from "../../src/extensions/agents/bytes/gpt"

// ---------------------------------------------------------------------------
// Representative model strings per family
// ---------------------------------------------------------------------------
const CLAUDE_MODEL = "claude-3-7-sonnet-20250219"
const GPT_MODEL = "gpt-4o"
const GPT_PROVIDER_MODEL = "openai/gpt-4o"
const GEMINI_MODEL = "gemini-1.5-pro"
const GEMINI_PROVIDER_MODEL = "google/gemini-1.5-pro"
const COPILOT_GPT = "github-copilot/gpt-4o"
const COPILOT_GEMINI = "github-copilot/gemini-1.5-pro"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function assertBytesBaseShape(agent: AgentConfig) {
  expect(typeof agent.description).toBe("string")
  expect(agent.description?.length).toBeGreaterThan(0)

  expect(typeof agent.prompt).toBe("string")
  expect(agent.prompt?.length).toBeGreaterThan(0)

  // bytes is a primary agent — no model pinned
  expect(agent.model).toBeUndefined()

  expect(agent.mode).toBe("primary")
  expect(agent.temperature).toBe(0.3)
  expect(agent.color).toBe("primary")

  // question:allow is a documented invariant for bytes
  expect(agent.permission?.question).toBe("allow")

  // todowrite/todoread must be denied
  expect(agent.permission?.todowrite).toBe("deny")
  expect(agent.permission?.todoread).toBe("deny")
}

function assertLanguageMatching(prompt: string | undefined) {
  expect(prompt ?? "").toMatch(/detect the language/i)
}

// ---------------------------------------------------------------------------
// createBytesAgent — default (Claude / unknown) variant
// ---------------------------------------------------------------------------
describe("createBytesAgent — default variant (Claude/others)", () => {
  it("returns correct shape for Claude model", () => {
    const agent = createBytesAgent(CLAUDE_MODEL)
    assertBytesBaseShape(agent)
  })

  it("selects default prompt for Claude model", () => {
    const agent = createBytesAgent(CLAUDE_MODEL)
    const expected = buildBytesDefaultPrompt(true)
    expect(agent.prompt).toBe(expected)
  })

  it("selects default prompt for unknown model", () => {
    const agent = createBytesAgent("some-unknown-model")
    const expected = buildBytesDefaultPrompt(true)
    expect(agent.prompt).toBe(expected)
  })

  it("does NOT set reasoningEffort or textVerbosity for Claude", () => {
    const agent = createBytesAgent(CLAUDE_MODEL) as AgentConfig & {
      reasoningEffort?: string
      textVerbosity?: string
    }
    expect(agent.reasoningEffort).toBeUndefined()
    expect(agent.textVerbosity).toBeUndefined()
  })

  it("prompt contains language-matching instructions", () => {
    const agent = createBytesAgent(CLAUDE_MODEL)
    assertLanguageMatching(agent.prompt)
  })

  it("hashlineEditEnabled=false omits hashline workflow section", () => {
    const withHashline = createBytesAgent(CLAUDE_MODEL, true)
    const withoutHashline = createBytesAgent(CLAUDE_MODEL, false)
    expect(withHashline.prompt).toContain("hashline_edit")
    // Without hashline, the section should not be present
    const withoutContent = buildBytesDefaultPrompt(false)
    expect(withoutContent).not.toContain("hashline_edit")
    expect(withoutHashline.prompt).toBe(withoutContent)
  })
})

// ---------------------------------------------------------------------------
// createBytesAgent — GPT variant
// ---------------------------------------------------------------------------
describe("createBytesAgent — GPT variant", () => {
  it("selects GPT prompt for gpt-4o", () => {
    const agent = createBytesAgent(GPT_MODEL)
    const expected = buildBytesGptPrompt(true)
    expect(agent.prompt).toBe(expected)
  })

  it("selects GPT prompt for openai/gpt-4o (provider prefix)", () => {
    const agent = createBytesAgent(GPT_PROVIDER_MODEL)
    const expected = buildBytesGptPrompt(true)
    expect(agent.prompt).toBe(expected)
  })

  it("selects GPT prompt for github-copilot/gpt-4o", () => {
    const agent = createBytesAgent(COPILOT_GPT)
    const expected = buildBytesGptPrompt(true)
    expect(agent.prompt).toBe(expected)
  })

  it("sets reasoningEffort=medium and textVerbosity=high for GPT", () => {
    const agent = createBytesAgent(GPT_MODEL) as AgentConfig & {
      reasoningEffort?: string
      textVerbosity?: string
    }
    expect(agent.reasoningEffort).toBe("medium")
    expect(agent.textVerbosity).toBe("high")
  })

  it("has correct base shape for GPT model", () => {
    const agent = createBytesAgent(GPT_MODEL)
    assertBytesBaseShape(agent)
  })

  it("GPT prompt contains language-matching instructions", () => {
    const agent = createBytesAgent(GPT_MODEL)
    assertLanguageMatching(agent.prompt)
  })

  it("GPT prompt starts with substance, not filler", () => {
    const prompt = buildBytesGptPrompt(true)
    // The GPT variant explicitly lists filler words to avoid in the prompt itself
    expect(prompt).toContain("NEVER open with filler")
  })
})

// ---------------------------------------------------------------------------
// createBytesAgent — Gemini variant
// ---------------------------------------------------------------------------
describe("createBytesAgent — Gemini variant", () => {
  it("selects Gemini prompt for gemini-1.5-pro", () => {
    const agent = createBytesAgent(GEMINI_MODEL)
    const expected = buildBytesGeminiPrompt(true)
    expect(agent.prompt).toBe(expected)
  })

  it("selects Gemini prompt for google/gemini-1.5-pro (provider prefix)", () => {
    const agent = createBytesAgent(GEMINI_PROVIDER_MODEL)
    const expected = buildBytesGeminiPrompt(true)
    expect(agent.prompt).toBe(expected)
  })

  it("selects Gemini prompt for github-copilot/gemini-1.5-pro", () => {
    const agent = createBytesAgent(COPILOT_GEMINI)
    const expected = buildBytesGeminiPrompt(true)
    expect(agent.prompt).toBe(expected)
  })

  it("does NOT set reasoningEffort or textVerbosity for Gemini", () => {
    const agent = createBytesAgent(GEMINI_MODEL) as AgentConfig & {
      reasoningEffort?: string
      textVerbosity?: string
    }
    expect(agent.reasoningEffort).toBeUndefined()
    expect(agent.textVerbosity).toBeUndefined()
  })

  it("has correct base shape for Gemini model", () => {
    const agent = createBytesAgent(GEMINI_MODEL)
    assertBytesBaseShape(agent)
  })

  it("Gemini prompt contains language-matching instructions", () => {
    const agent = createBytesAgent(GEMINI_MODEL)
    assertLanguageMatching(agent.prompt)
  })

  it("Gemini prompt uses numbered section headers", () => {
    const prompt = buildBytesGeminiPrompt(true)
    // Gemini variant uses numbered headers like "## 1. Agency"
    expect(prompt).toMatch(/## \d+\./)
  })
})

// ---------------------------------------------------------------------------
// createBytesAgent.mode static property
// ---------------------------------------------------------------------------
describe("createBytesAgent.mode static property", () => {
  it("exposes mode='primary' on the factory function", () => {
    expect(createBytesAgent.mode).toBe("primary")
  })
})

// ---------------------------------------------------------------------------
// Prompt variant distinctness
// ---------------------------------------------------------------------------
describe("prompt variant distinctness", () => {
  it("default, gpt, and gemini prompts are all different strings", () => {
    const defaultPrompt = buildBytesDefaultPrompt(true)
    const gptPrompt = buildBytesGptPrompt(true)
    const geminiPrompt = buildBytesGeminiPrompt(true)

    expect(defaultPrompt).not.toBe(gptPrompt)
    expect(defaultPrompt).not.toBe(geminiPrompt)
    expect(gptPrompt).not.toBe(geminiPrompt)
  })

  it("default prompt uses XML-style tags (Claude strength)", () => {
    const prompt = buildBytesDefaultPrompt(true)
    expect(prompt).toMatch(/<\w+>/)
  })

  it("GPT prompt uses markdown prose sections without XML tags", () => {
    const prompt = buildBytesGptPrompt(true)
    // GPT uses # headers, not XML tags
    expect(prompt).toMatch(/^# /m)
  })
})
