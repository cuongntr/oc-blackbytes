function extractModelName(model: string): string {
  return model.includes("/") ? (model.split("/").pop() ?? model) : model
}

export function isGptModel(model: string): boolean {
  const modelName = extractModelName(model).toLowerCase()
  return modelName.includes("gpt")
}

export function isGpt5_4Model(model: string): boolean {
  const modelName = extractModelName(model).toLowerCase()
  return modelName.includes("gpt-5.4") || modelName.includes("gpt-5-4")
}

export function isGpt5_3CodexModel(model: string): boolean {
  const modelName = extractModelName(model).toLowerCase()
  return modelName.includes("gpt-5.3-codex") || modelName.includes("gpt-5-3-codex")
}

const GEMINI_PROVIDERS = ["google/", "google-vertex/"]

export function isMiniMaxModel(model: string): boolean {
  const modelName = extractModelName(model).toLowerCase()
  return modelName.includes("minimax")
}

export function isGlmModel(model: string): boolean {
  const modelName = extractModelName(model).toLowerCase()
  return modelName.includes("glm")
}

const CLAUDE_PROVIDERS = ["anthropic/"]

export function isClaudeModel(model: string): boolean {
  if (CLAUDE_PROVIDERS.some((prefix) => model.startsWith(prefix))) return true

  if (
    model.startsWith("github-copilot/") &&
    extractModelName(model).toLowerCase().startsWith("claude")
  )
    return true

  const modelName = extractModelName(model).toLowerCase()
  return modelName.startsWith("claude-")
}

export function isKimiModel(model: string): boolean {
  const modelName = extractModelName(model).toLowerCase()
  return modelName.includes("kimi") || modelName.includes("moonshot")
}

export function isDeepSeekModel(model: string): boolean {
  const modelName = extractModelName(model).toLowerCase()
  return modelName.includes("deepseek")
}

export function isGeminiModel(model: string): boolean {
  if (GEMINI_PROVIDERS.some((prefix) => model.startsWith(prefix))) return true

  if (
    model.startsWith("github-copilot/") &&
    extractModelName(model).toLowerCase().startsWith("gemini")
  )
    return true

  const modelName = extractModelName(model).toLowerCase()
  return modelName.startsWith("gemini-")
}
