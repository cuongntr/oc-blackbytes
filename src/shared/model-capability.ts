/**
 * Model capability registry and compatibility resolution.
 *
 * Provides:
 * 1. Regex-based model family detection with per-family capability definitions
 * 2. Ladder-based graceful downgrading for unsupported settings
 * 3. Structured change tracking for debugging parameter modifications
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModelFamily = "claude" | "openai" | "gemini" | "other"

export type ModelFamilyDefinition = {
  /** Human-readable family name */
  family: ModelFamily
  /** Provider IDs that map directly to this family */
  providerIDs?: string[]
  /** Regex patterns matched against the model name (after stripping provider prefix) */
  patterns?: RegExp[]
  /** Whether models in this family support thinking/extended thinking */
  supportsThinking: boolean
  /** Allowed reasoning effort levels (ordered low→high) */
  reasoningEfforts?: readonly string[]
}

export type CompatibilityChange = {
  field: "reasoningEffort" | "thinking"
  from: string
  to: string | undefined
  reason: "unsupported-by-model-family" | "downgraded"
}

export type ResolvedSettings = {
  thinking?: { type: string; budgetTokens?: number }
  reasoningEffort?: string
  changes: CompatibilityChange[]
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const MODEL_FAMILY_REGISTRY: readonly ModelFamilyDefinition[] = [
  {
    family: "claude",
    providerIDs: ["anthropic"],
    patterns: [/^claude-/i, /^claude\d/i],
    supportsThinking: true,
  },
  {
    family: "openai",
    providerIDs: ["openai"],
    patterns: [/^gpt-/i, /^o\d(?:$|-)/i],
    supportsThinking: false,
    reasoningEfforts: ["low", "medium", "high"],
  },
  {
    family: "gemini",
    providerIDs: ["google", "google-vertex"],
    patterns: [/^gemini-/i],
    supportsThinking: false,
  },
]

// ---------------------------------------------------------------------------
// Ladders
// ---------------------------------------------------------------------------

const REASONING_LADDER: readonly string[] = ["none", "minimal", "low", "medium", "high", "xhigh"]

/**
 * Walks backwards from the requested level to find the nearest supported value.
 */
function downgradeWithinLadder(
  value: string,
  allowed: readonly string[],
  ladder: readonly string[],
): string | undefined {
  const requestedIndex = ladder.indexOf(value)
  if (requestedIndex === -1) return undefined

  for (let i = requestedIndex; i >= 0; i--) {
    if (allowed.includes(ladder[i])) {
      return ladder[i]
    }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function extractModelName(modelRef: string): string {
  return modelRef.includes("/") ? (modelRef.split("/").pop() ?? modelRef) : modelRef
}

/**
 * Determines the correct thinking type for a Claude model.
 *
 * Defaults to "adaptive" for modern models (4.6+). Falls back to "enabled"
 * for known older models that don't support adaptive thinking:
 * - Haiku: no adaptive support on any version
 * - Claude 3.x: predates adaptive thinking
 * - Opus/Sonnet 4.0-4.5: require "enabled" with budget_tokens
 *
 * This default-adaptive approach is future-proof: Anthropic explicitly states
 * that "enabled" is rejected on Opus 4.7+ and deprecated on 4.6.
 */
function resolveThinkingType(modelRef: string): "adaptive" | "enabled" {
  const modelName = extractModelName(modelRef).toLowerCase()

  // Haiku models don't support adaptive thinking
  if (modelName.includes("haiku")) return "enabled"

  // Claude 3.x models don't support adaptive thinking
  if (modelName.includes("claude-3")) return "enabled"

  // Parse version for opus/sonnet: 4.5 and below require "enabled"
  // Distinguishes sub-version (1-2 digits) from date suffixes (8 digits)
  const match = modelName.match(/(?:opus|sonnet)-(\d+)(?:-(\d{1,2})(?:\D|$))?/)
  if (match) {
    const major = Number.parseInt(match[1], 10)
    const minor = match[2] !== undefined ? Number.parseInt(match[2], 10) : 0
    if (major < 4 || (major === 4 && minor <= 5)) return "enabled"
  }

  // Default: adaptive for 4.6+ and unknown future Claude models
  return "adaptive"
}

/**
 * Detects model family from provider ID and model reference string.
 * Checks provider ID first (most reliable), then falls back to pattern matching.
 */
export function detectModelFamily(providerID: string, modelRef: string): ModelFamily {
  // Direct provider match
  for (const def of MODEL_FAMILY_REGISTRY) {
    if (def.providerIDs?.includes(providerID)) {
      return def.family
    }
  }

  // Pattern match on model name (for github-copilot and proxy providers)
  const modelName = extractModelName(modelRef).toLowerCase()
  for (const def of MODEL_FAMILY_REGISTRY) {
    if (def.patterns?.some((p) => p.test(modelName))) {
      return def.family
    }
  }

  return "other"
}

/**
 * Returns the family definition for a given family, or undefined for "other".
 */
function getFamilyDef(family: ModelFamily): ModelFamilyDefinition | undefined {
  return MODEL_FAMILY_REGISTRY.find((d) => d.family === family)
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/** Default thinking budget per agent for Claude models */
const CLAUDE_THINKING_BUDGET: Record<string, number> = {
  bytes: 32000,
  oracle: 32000,
  general: 16000,
}

/** Default reasoning effort per agent for OpenAI models */
const OPENAI_REASONING_DEFAULTS: Record<string, string> = {
  bytes: "medium",
  oracle: "high",
  general: "medium",
}

/**
 * Resolves model settings against detected capabilities, applying graceful
 * downgrading where needed and tracking all changes.
 */
export function resolveModelSettings(opts: {
  family: ModelFamily
  agentName: string
  modelRef: string
  supportsReasoning: boolean
  userReasoningEffort?: string
}): ResolvedSettings {
  const { family, agentName, modelRef, supportsReasoning, userReasoningEffort } = opts
  const def = getFamilyDef(family)
  const changes: CompatibilityChange[] = []

  const result: ResolvedSettings = { changes }

  if (family === "claude") {
    // Thinking — only for agents with configured budgets
    if (supportsReasoning) {
      const budget = CLAUDE_THINKING_BUDGET[agentName]
      if (budget) {
        const thinkingType = resolveThinkingType(modelRef)
        if (thinkingType === "adaptive") {
          result.thinking = { type: "adaptive" }
        } else {
          result.thinking = { type: "enabled", budgetTokens: budget }
        }
      }
    }
    // No reasoningEffort for Claude
    return result
  }

  if (family === "openai") {
    // Reasoning effort
    if (supportsReasoning) {
      const desired = userReasoningEffort ?? OPENAI_REASONING_DEFAULTS[agentName]
      if (desired && def?.reasoningEfforts) {
        if (def.reasoningEfforts.includes(desired)) {
          result.reasoningEffort = desired
        } else {
          // Graceful downgrade
          const downgraded = downgradeWithinLadder(desired, def.reasoningEfforts, REASONING_LADDER)
          result.reasoningEffort = downgraded
          changes.push({
            field: "reasoningEffort",
            from: desired,
            to: downgraded,
            reason: "downgraded",
          })
        }
      } else if (desired) {
        result.reasoningEffort = desired
      }
    }
    // No thinking for OpenAI
    return result
  }

  // gemini / other: no thinking, no reasoning
  return result
}
