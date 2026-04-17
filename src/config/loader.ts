import { existsSync, readFileSync } from "node:fs"
import type { PluginInput } from "@opencode-ai/plugin"
import { detectPluginConfigFile, getOpenCodeConfigDir, log, parseJsonc } from "../shared"
import { type OcBlackbytesConfig, OcBlackbytesConfigSchema } from "./schema"

export function loadConfigFromPath(configPath: string): OcBlackbytesConfig | null {
  if (!existsSync(configPath)) {
    return null
  }

  try {
    const content = readFileSync(configPath, "utf-8")
    const rawConfig = parseJsonc<unknown>(content)
    const result = OcBlackbytesConfigSchema.safeParse(rawConfig)

    if (!result.success) {
      log(`Config validation error in ${configPath}:`, result.error.issues)
      return null
    }

    return result.data
  } catch (error) {
    log(`Error loading config from ${configPath}:`, error)
    return null
  }
}

export function loadPluginConfig(input: PluginInput): {
  config: OcBlackbytesConfig
  warnings: string[]
} {
  const warnings: string[] = []
  const binary = typeof input.client === "string" && input.client ? input.client : "opencode"
  const configDir = getOpenCodeConfigDir({ binary })
  const detected = detectPluginConfigFile(configDir)

  if (!existsSync(detected.path)) {
    warnings.push(`[oc-blackbytes] No config file found at ${detected.path}, using defaults`)
    return { config: {}, warnings }
  }

  try {
    const content = readFileSync(detected.path, "utf-8")
    let rawConfig: unknown
    try {
      rawConfig = parseJsonc<unknown>(content)
    } catch (parseError) {
      warnings.push(`[oc-blackbytes] Failed to parse JSONC in ${detected.path}: ${parseError}`)
      return { config: {}, warnings }
    }

    const result = OcBlackbytesConfigSchema.safeParse(rawConfig)
    if (!result.success) {
      const issues = result.error.issues.map((i) => i.message).join("; ")
      warnings.push(`[oc-blackbytes] Schema validation errors in ${detected.path}: ${issues}`)
      log(`Config validation error in ${detected.path}:`, result.error.issues)
      return { config: {}, warnings }
    }

    return { config: result.data, warnings }
  } catch (error) {
    warnings.push(`[oc-blackbytes] Error loading config from ${detected.path}: ${error}`)
    log(`Error loading config from ${detected.path}:`, error)
    return { config: {}, warnings }
  }
}
