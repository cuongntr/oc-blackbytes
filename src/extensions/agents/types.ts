import type { AgentConfig } from "@opencode-ai/sdk"

/**
 * Agent mode determises UI model selection behavior.
 * - "primary": Respects user's UI-selected model
 * - "subagent": Uses own fallback chain, ignores UI selection
 * - "all": Avaiable in both contexts (OpenCode compatibility)
 */
export type AgentMode = "primary" | "subagent" | "all"

export type AgentFactory = ((model: string) => AgentConfig) & { mode: AgentMode }

export type AgentCategory = "exploration" | "specialist" | "advisor" | "utility"

export type AgentCost = "FREE" | "CHEAP" | "EXPENSIVE"

export interface DelegationTrigger {
  /* Domain of work (e.g., "Fontend UI/UX") */
  domain: string
  /* When to delegate (e.g., "Visual changes only....") */
  trigger: string
}

export type AgentPromptMetadata = {
  category: AgentCategory
  cost: AgentCost
  triggers: DelegationTrigger[]
  useWhen?: string[]
  avoidWhen?: string[]
  dedicatedSection?: string
  promptAlias?: string
  keyTrigger?: string
}

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
