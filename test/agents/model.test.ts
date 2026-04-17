import { describe, expect, it } from "bun:test"
import {
  isClaudeModel,
  isDeepSeekModel,
  isGeminiModel,
  isGlmModel,
  isGpt5_3CodexModel,
  isGpt5_4Model,
  isGptModel,
  isKimiModel,
  isMiniMaxModel,
} from "../../src/extensions/agents/utils/model"

describe("isGptModel", () => {
  it("returns true for gpt models", () => {
    expect(isGptModel("gpt-4o")).toBe(true)
    expect(isGptModel("gpt-3.5-turbo")).toBe(true)
    expect(isGptModel("openai/gpt-4")).toBe(true)
    expect(isGptModel("github-copilot/gpt-4o")).toBe(true)
  })

  it("returns false for non-gpt models", () => {
    expect(isGptModel("claude-3-opus")).toBe(false)
    expect(isGptModel("gemini-pro")).toBe(false)
    expect(isGptModel("deepseek-v3")).toBe(false)
  })
})

describe("isGpt5_4Model", () => {
  it("returns true for gpt-5.4 variants", () => {
    expect(isGpt5_4Model("gpt-5.4")).toBe(true)
    expect(isGpt5_4Model("gpt-5-4")).toBe(true)
    expect(isGpt5_4Model("openai/gpt-5.4-turbo")).toBe(true)
  })

  it("returns false for other gpt models", () => {
    expect(isGpt5_4Model("gpt-4o")).toBe(false)
    expect(isGpt5_4Model("gpt-5")).toBe(false)
  })
})

describe("isGpt5_3CodexModel", () => {
  it("returns true for gpt-5.3-codex variants", () => {
    expect(isGpt5_3CodexModel("gpt-5.3-codex")).toBe(true)
    expect(isGpt5_3CodexModel("gpt-5-3-codex")).toBe(true)
    expect(isGpt5_3CodexModel("openai/gpt-5.3-codex-mini")).toBe(true)
  })

  it("returns false for other models", () => {
    expect(isGpt5_3CodexModel("gpt-5.4")).toBe(false)
    expect(isGpt5_3CodexModel("codex")).toBe(false)
  })
})

describe("isClaudeModel", () => {
  it("returns true for anthropic/ prefixed models", () => {
    expect(isClaudeModel("anthropic/claude-3-opus")).toBe(true)
    expect(isClaudeModel("anthropic/claude-3.5-sonnet")).toBe(true)
  })

  it("returns true for github-copilot/claude-* models", () => {
    expect(isClaudeModel("github-copilot/claude-3.5-sonnet")).toBe(true)
    expect(isClaudeModel("github-copilot/claude-opus-4")).toBe(true)
  })

  it("returns true for bare claude- prefixed model names", () => {
    expect(isClaudeModel("claude-3-haiku")).toBe(true)
    expect(isClaudeModel("claude-3.5-sonnet")).toBe(true)
  })

  it("returns false for non-claude models", () => {
    expect(isClaudeModel("gpt-4o")).toBe(false)
    expect(isClaudeModel("gemini-pro")).toBe(false)
    expect(isClaudeModel("github-copilot/gpt-4o")).toBe(false)
  })
})

describe("isGeminiModel", () => {
  it("returns true for google/ prefixed models", () => {
    expect(isGeminiModel("google/gemini-pro")).toBe(true)
    expect(isGeminiModel("google-vertex/gemini-1.5-pro")).toBe(true)
  })

  it("returns true for github-copilot/gemini-* models", () => {
    expect(isGeminiModel("github-copilot/gemini-2.0-flash")).toBe(true)
  })

  it("returns true for bare gemini- prefixed names", () => {
    expect(isGeminiModel("gemini-pro")).toBe(true)
    expect(isGeminiModel("gemini-1.5-flash")).toBe(true)
  })

  it("returns false for non-gemini models", () => {
    expect(isGeminiModel("gpt-4o")).toBe(false)
    expect(isGeminiModel("claude-3-opus")).toBe(false)
  })
})

describe("isDeepSeekModel", () => {
  it("returns true for deepseek models", () => {
    expect(isDeepSeekModel("deepseek-v3")).toBe(true)
    expect(isDeepSeekModel("openai/deepseek-r1")).toBe(true)
  })

  it("returns false for other models", () => {
    expect(isDeepSeekModel("gpt-4o")).toBe(false)
  })
})

describe("isKimiModel", () => {
  it("returns true for kimi / moonshot models", () => {
    expect(isKimiModel("kimi-k1")).toBe(true)
    expect(isKimiModel("moonshot-v1")).toBe(true)
  })

  it("returns false for other models", () => {
    expect(isKimiModel("gpt-4o")).toBe(false)
  })
})

describe("isMiniMaxModel", () => {
  it("returns true for minimax models", () => {
    expect(isMiniMaxModel("minimax-01")).toBe(true)
    expect(isMiniMaxModel("MiniMax-Text")).toBe(true)
  })

  it("returns false for others", () => {
    expect(isMiniMaxModel("gpt-4o")).toBe(false)
  })
})

describe("isGlmModel", () => {
  it("returns true for glm models", () => {
    expect(isGlmModel("glm-4")).toBe(true)
    expect(isGlmModel("GLM-4-flash")).toBe(true)
  })

  it("returns false for others", () => {
    expect(isGlmModel("claude-3")).toBe(false)
  })
})

describe("provider-prefixed model extraction", () => {
  it("strips provider prefix before matching", () => {
    // provider/model-name — the model name part is extracted after last '/'
    expect(isGptModel("some-provider/gpt-4o")).toBe(true)
    // isClaudeModel checks the model name part 'claude-3-opus' which starts with 'claude-' → true
    expect(isClaudeModel("some-provider/claude-3-opus")).toBe(true)
    expect(isClaudeModel("some-provider/gpt-4o")).toBe(false)
    // Bare name starting with claude- is also picked up
    expect(isClaudeModel("claude-3-opus")).toBe(true)
  })
})
