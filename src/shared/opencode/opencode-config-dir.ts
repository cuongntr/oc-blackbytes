import { existsSync, realpathSync } from "node:fs"
import { homedir } from "node:os"
import { join, resolve, win32 } from "node:path"
import { CONFIG_BASENAME } from "../constants"

export type OpenCodeBinaryType = "opencode" | "opencode-desktop"
export type OpenCodeConfigDirOptions = {
  binary: OpenCodeBinaryType
  version?: string
  checkExisting?: boolean
}
export type OpenCodeConfigPaths = {
  configDir: string
  configJson: string
  configJsonc: string
  packageJson: string
  ocbConfig: string
}

export const TAURI_APP_IDENTIFIER = "ai.opencode.desktop"
export const TAURI_APP_IDENTIFIER_DEV = "ai.opencode.desktop.dev"

export function isDevBuild(version: string | null | undefined): boolean {
  if (!version) return false
  return version.includes("-dev") || version.includes(".dev")
}

function getTauriConfigDir(identifier: string): string {
  const platform = process.platform

  switch (platform) {
    case "darwin":
      return join(homedir(), "Library", "Application Support", identifier)
    case "win32": {
      const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming")
      return win32.join(appData, identifier)
    }
    default: {
      const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), ".config")
      return join(xdgConfig, identifier)
    }
  }
}

/**
 * Resolves a configuration path, returning the real path if it exists,
 * or the resolved path if it doesn't.
 **/
function resolveConfigPath(pathValue: string): string {
  const resolvedPath = resolve(pathValue)
  if (!existsSync(resolvedPath)) return resolvedPath
  try {
    return realpathSync(resolvedPath)
  } catch {
    return resolvedPath
  }
}

/**
 * Determines the CLI configuration directory for OpenCode. It first checks for the `OPENCODE_CONFIG_DIR`
 * environment variable, then falls back to the XDG_CONFIG_HOME or the default `.config` directory in the user's home.
 */
function getCliConfigDir(): string {
  const envConfigDir = process.env.OPENCODE_CONFIG_DIR
  if (envConfigDir) {
    return resolveConfigPath(envConfigDir)
  }

  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), ".config")

  return resolveConfigPath(join(xdgConfig, "opencode"))
}

/**
 * Determines the appropriate configuration directory for OpenCode based on the binary type,
 * version, and existing configurations. It checks for legacy CLI config if `checkExisting` is true,
 * and falls back to Tauri-specific config directories based on the platform.
 */
export function getOpenCodeConfigDir(options: OpenCodeConfigDirOptions): string {
  const { binary, version, checkExisting = true } = options

  if (binary === "opencode") {
    return getCliConfigDir()
  }

  const identifier = isDevBuild(version) ? TAURI_APP_IDENTIFIER_DEV : TAURI_APP_IDENTIFIER
  const tauriDirBase = getTauriConfigDir(identifier)
  const tauriDir =
    process.platform === "win32"
      ? win32.isAbsolute(tauriDirBase)
        ? win32.normalize(tauriDirBase)
        : win32.resolve(tauriDirBase)
      : resolveConfigPath(tauriDirBase)

  if (checkExisting) {
    const legacyDir = getCliConfigDir()
    const legacyConfig = join(legacyDir, "opencode.json")
    const legacyConfigC = join(legacyDir, "opencode.jsonc")

    if (existsSync(legacyConfig) || existsSync(legacyConfigC)) {
      return legacyDir
    }
  }

  return tauriDir
}

/**
 * Given the options for determining the OpenCode configuration directory, this function returns the
 * resolved paths for the config directory and relevant config files (opencode.json, opencode.jsonc,
 * package.json, and the plugin-specific config file).
 */
export function getOpenCodeConfigPaths(options: OpenCodeConfigDirOptions): OpenCodeConfigPaths {
  const configDir = getOpenCodeConfigDir(options)
  return {
    configDir,
    configJson: join(configDir, "opencode.json"),
    configJsonc: join(configDir, "opencode.jsonc"),
    packageJson: join(configDir, "package.json"),
    ocbConfig: join(configDir, `${CONFIG_BASENAME}.json`),
  }
}

/**
 * Detects if there is an existing OpenCode configuration directory with a config file (opencode.json or opencode.jsonc).
 */
export function detectExistingConfigDir(
  binary: OpenCodeBinaryType,
  version?: string | null,
): string | null {
  const locations: string[] = []

  const envConfigDir = process.env.OPENCODE_CONFIG_DIR?.trim()
  if (envConfigDir) {
    locations.push(resolveConfigPath(envConfigDir))
  }

  if (binary === "opencode-desktop") {
    const identifier = isDevBuild(version) ? TAURI_APP_IDENTIFIER_DEV : TAURI_APP_IDENTIFIER
    locations.push(getTauriConfigDir(identifier))

    if (isDevBuild(version)) {
      locations.push(getTauriConfigDir(TAURI_APP_IDENTIFIER))
    }
  }

  locations.push(getCliConfigDir())

  for (const dir of locations) {
    const configJson = join(dir, "opencode.json")
    const configJsonc = join(dir, "opencode.jsonc")

    if (existsSync(configJson) || existsSync(configJsonc)) {
      return dir
    }
  }

  return null
}
