import type { PluginInput } from "@opencode-ai/plugin"
import type {
  AgentModelConfig,
  FallbackModelObject,
  OcBlackbytesConfig,
} from "../config/schema/oc-blackbytes-config"
import { log } from "../shared"
import { BUILTIN_FALLBACK_CHAINS, type FallbackChainEntry } from "./model-requirements"

type FallbackEntry = string | FallbackModelObject
type FallbackModels = string | FallbackEntry[]

/**
 * Map of provider ID → Set of available model IDs.
 * Only includes connected providers (those with valid credentials).
 */
export type AvailableModels = Map<string, Set<string>>

/**
 * Result of resolving a model through the fallback chain.
 * When `fromFallback` is true, the overrides came from a fallback entry
 * and should take priority over the agent's static config.
 */
export type ResolvedModel = {
  model: string
  fromFallback: boolean
  reasoningEffort?: string
  temperature?: number
}

/**
 * Discovers connected providers and their available models by querying the OpenCode server API.
 * Returns a map of provider ID → Set of model IDs for providers with valid credentials.
 *
 * If discovery fails (server not ready, network error, etc.),
 * returns an empty map — fallback resolution will be skipped gracefully.
 */
export async function discoverAvailableModels(
  client: PluginInput["client"],
): Promise<AvailableModels> {
  try {
    const result = await client.provider.list()
    const data = result.data
    if (!data) {
      log("[model-resolver] Provider list returned no data, skipping fallback resolution")
      return new Map()
    }

    const connected = new Set(data.connected)
    const models: AvailableModels = new Map()

    for (const provider of data.all ?? []) {
      if (!connected.has(provider.id)) continue
      const modelIds = new Set(Object.keys(provider.models ?? {}))
      if (modelIds.size > 0) {
        models.set(provider.id, modelIds)
      }
    }

    const providerSummary = [...models.entries()].map(([id, m]) => `${id}(${m.size})`).join(", ")
    log(`[model-resolver] Available: ${providerSummary || "(none)"}`)

    return models
  } catch (e) {
    log(`[model-resolver] Failed to discover providers: ${e}`)
    return new Map()
  }
}

/**
 * Resolves a model reference against the discovered model list.
 * Model refs must be in "provider/model" format to be validated.
 *
 * Returns:
 * - The canonical available model ref when the exact model exists
 * - The canonical available model ref when the configured model is a prefix match
 *   (e.g. date-suffixed variants)
 * - The original ref when it has no provider prefix or discovery was skipped
 * - undefined when the provider is disconnected or the model is not available
 */
function resolveModelRef(modelRef: string, availableModels: AvailableModels): string | undefined {
  if (availableModels.size === 0) return modelRef

  const slashIdx = modelRef.indexOf("/")
  if (slashIdx === -1) return modelRef

  const providerId = modelRef.substring(0, slashIdx)
  const modelId = modelRef.substring(slashIdx + 1)
  const providerModels = availableModels.get(providerId)
  if (!providerModels) return undefined

  const matchedModel = prefixMatchModel(modelId, providerModels)
  return matchedModel ? `${providerId}/${matchedModel}` : undefined
}

/**
 * Prefix-matches a model name against the actual model list from a provider.
 * Handles date-suffixed model IDs: "claude-sonnet-4-6" matches "claude-sonnet-4-6-20260401".
 *
 * To avoid matching different model variants (e.g., "gpt-5.4" should NOT match "gpt-5.4-mini"),
 * the prefix must match at a boundary: end-of-string or followed by "-" and a digit (date suffix).
 *
 * Returns the matched model ID or undefined.
 */
function prefixMatchModel(modelPrefix: string, providerModels: Set<string>): string | undefined {
  // Exact match first
  if (providerModels.has(modelPrefix)) return modelPrefix

  // Prefix match with boundary check — find shortest match to prefer exact versions
  let bestMatch: string | undefined
  for (const available of providerModels) {
    if (available.startsWith(modelPrefix)) {
      const rest = available.substring(modelPrefix.length)
      // Must be at a boundary: end of string, or followed by "-" + digit (date suffix)
      // This prevents "gpt-5.4" from matching "gpt-5.4-mini" while allowing "gpt-5.4-20260315"
      if (rest === "" || /^-\d/.test(rest)) {
        if (!bestMatch || available.length < bestMatch.length) {
          bestMatch = available
        }
      }
    }
  }
  return bestMatch
}

/**
 * Resolves a single builtin fallback chain entry against available models.
 * Tries each provider in order, using prefix matching against the actual model list.
 *
 * Returns the resolved "provider/model" string and the entry's parameter overrides,
 * or undefined if no provider has a matching model.
 */
function resolveChainEntry(
  entry: FallbackChainEntry,
  availableModels: AvailableModels,
): ResolvedModel | undefined {
  for (const provider of entry.providers) {
    const providerModels = availableModels.get(provider)
    if (!providerModels) continue

    const matched = prefixMatchModel(entry.model, providerModels)
    if (matched) {
      return {
        model: `${provider}/${matched}`,
        fromFallback: true,
        reasoningEffort: entry.reasoningEffort,
        temperature: entry.temperature,
      }
    }
  }
  return undefined
}

/**
 * Walks a user-configured fallback chain and returns the first available model.
 * Returns undefined if no model in the chain is available.
 */
function walkFallbackChain(
  fallbacks: FallbackModels | undefined,
  availableModels: AvailableModels,
): ResolvedModel | undefined {
  if (!fallbacks) return undefined

  const chain: FallbackEntry[] = typeof fallbacks === "string" ? [fallbacks] : fallbacks

  for (const entry of chain) {
    const modelRef = typeof entry === "string" ? entry : entry.model
    const resolvedModel = resolveModelRef(modelRef, availableModels)
    if (resolvedModel) {
      return typeof entry === "string"
        ? { model: resolvedModel, fromFallback: true }
        : {
            model: resolvedModel,
            fromFallback: true,
            reasoningEffort: entry.reasoningEffort,
            temperature: entry.temperature,
          }
    }
  }

  return undefined
}

/**
 * Walks a builtin fallback chain against the available model list.
 * Uses prefix matching and multi-provider expansion.
 */
function walkBuiltinChain(
  agentName: string,
  availableModels: AvailableModels,
): ResolvedModel | undefined {
  const chain = BUILTIN_FALLBACK_CHAINS[agentName]
  if (!chain) return undefined

  for (const entry of chain) {
    const resolved = resolveChainEntry(entry, availableModels)
    if (resolved) return resolved
  }
  return undefined
}

/**
 * Resolves the effective model for a single agent by checking availability
 * and walking fallback chains.
 *
 * Resolution order:
 * 1. Agent's configured model — if provider is connected, use it
 * 2. Agent's per-agent `fallback_models` chain (user config)
 * 3. Builtin hardcoded chain — multi-provider, prefix-matched against actual models
 * 4. Global `fallback_models` chain (user config)
 * 5. Empty string — OpenCode uses its default model
 */
function resolveAgentModel(
  agentName: string,
  agentConfig: AgentModelConfig | undefined,
  globalFallbacks: FallbackModels | undefined,
  availableModels: AvailableModels,
): ResolvedModel {
  const primaryModel = agentConfig?.model

  // No model configured → try fallback chains in priority order, then OpenCode default
  if (!primaryModel) {
    const perAgentResolved = walkFallbackChain(agentConfig?.fallback_models, availableModels)
    if (perAgentResolved) {
      log(`  [model-resolver] ${agentName}: resolved → ${perAgentResolved.model} (agent fallback)`)
      return perAgentResolved
    }

    const builtinResolved = walkBuiltinChain(agentName, availableModels)
    if (builtinResolved) {
      log(`  [model-resolver] ${agentName}: resolved → ${builtinResolved.model} (builtin chain)`)
      return builtinResolved
    }

    const globalResolved = walkFallbackChain(globalFallbacks, availableModels)
    if (globalResolved) {
      log(`  [model-resolver] ${agentName}: resolved → ${globalResolved.model} (global fallback)`)
      return globalResolved
    }

    return { model: "", fromFallback: false }
  }

  const resolvedPrimaryModel = resolveModelRef(primaryModel, availableModels)
  if (resolvedPrimaryModel) {
    log(`  [model-resolver] ${agentName}: using primary model ${resolvedPrimaryModel}`)
    return { model: resolvedPrimaryModel, fromFallback: false }
  }

  log(
    `  [model-resolver] ${agentName}: primary model ${primaryModel} not available, trying fallbacks...`,
  )

  // Per-agent user fallback chain
  const perAgentResolved = walkFallbackChain(agentConfig?.fallback_models, availableModels)
  if (perAgentResolved) {
    log(`  [model-resolver] ${agentName}: resolved → ${perAgentResolved.model} (agent fallback)`)
    return perAgentResolved
  }

  // Builtin hardcoded chain
  const builtinResolved = walkBuiltinChain(agentName, availableModels)
  if (builtinResolved) {
    log(`  [model-resolver] ${agentName}: resolved → ${builtinResolved.model} (builtin chain)`)
    return builtinResolved
  }

  // Global user fallback chain
  const globalResolved = walkFallbackChain(globalFallbacks, availableModels)
  if (globalResolved) {
    log(`  [model-resolver] ${agentName}: resolved → ${globalResolved.model} (global fallback)`)
    return globalResolved
  }

  log(`  [model-resolver] ${agentName}: no available fallback, using OpenCode default`)
  return { model: "", fromFallback: false }
}

/**
 * Resolves models for all agents using fallback chains.
 *
 * When `model_fallback` is enabled and available models are discovered:
 * - Agents with user-configured models get availability checking
 * - Agents without explicit models get the builtin fallback chain
 * - Each agent is resolved independently
 *
 * When a fallback entry includes parameter overrides (reasoningEffort, temperature),
 * those override the agent's static config since they're tuned for that specific model.
 */
export function resolveAllAgentModels(
  pluginConfig: OcBlackbytesConfig,
  availableModels: AvailableModels,
): Record<string, AgentModelConfig> | undefined {
  const agentOverrides = pluginConfig.agents
  const globalFallbacks = pluginConfig.fallback_models

  // Build a set of all agent names to resolve — both user-configured and builtin
  const agentNames = new Set([
    ...Object.keys(BUILTIN_FALLBACK_CHAINS),
    ...(agentOverrides ? Object.keys(agentOverrides) : []),
  ])

  if (agentNames.size === 0) return undefined

  const resolved: Record<string, AgentModelConfig> = {}

  log("[model-resolver] Resolving agent models with fallback chains...")

  for (const name of agentNames) {
    const config = agentOverrides?.[name]
    const resolution = resolveAgentModel(name, config, globalFallbacks, availableModels)

    resolved[name] = {
      ...config,
      // Use resolved model (empty string means "use OpenCode default")
      model: resolution.model || undefined,
      // Fallback entry overrides only apply when the user hasn't explicitly set the parameter.
      // This ensures user preferences always win, while builtin chain params serve as defaults.
      ...(resolution.fromFallback &&
      resolution.reasoningEffort !== undefined &&
      config?.reasoningEffort === undefined
        ? { reasoningEffort: resolution.reasoningEffort }
        : {}),
      ...(resolution.fromFallback &&
      resolution.temperature !== undefined &&
      config?.temperature === undefined
        ? { temperature: resolution.temperature }
        : {}),
    }
  }

  return resolved
}
