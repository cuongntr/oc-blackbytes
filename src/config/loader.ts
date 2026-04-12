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

export function loadPluginConfig(_input: PluginInput): OcBlackbytesConfig {
  const configDir = getOpenCodeConfigDir({ binary: "opencode" })
  const detected = detectPluginConfigFile(configDir)

  return loadConfigFromPath(detected.path) ?? {}
}
