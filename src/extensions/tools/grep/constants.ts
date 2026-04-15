import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { PLUGIN_NAME } from "../../../shared/constants/plugin-identity"
import { log } from "../../../shared/utils/logger"
import { downloadAndInstallRipgrep, getInstalledRipgrepPath } from "./downloader"

export type GrepBackend = "rg" | "grep"

export interface ResolvedCli {
  path: string
  backend: GrepBackend
}

let cachedCli: ResolvedCli | null = null
let autoInstallAttempted = false

function findExecutable(name: string): string | null {
  const isWindows = process.platform === "win32"
  const cmd = isWindows ? "where" : "which"

  try {
    const result = Bun.spawnSync([cmd, name], { stdout: "pipe", stderr: "pipe" })
    if (result.exitCode === 0) {
      const output = result.stdout.toString().trim()
      if (output) return output.split("\n")[0]
    }
  } catch {
    // Command execution failed
  }
  return null
}

function getXdgDataDir(): string {
  const home = homedir()
  const platform = process.platform

  if (platform === "darwin") {
    return join(home, "Library", "Application Support")
  }
  if (platform === "win32") {
    return process.env.LOCALAPPDATA || join(home, "AppData", "Local")
  }
  return process.env.XDG_DATA_HOME || join(home, ".local", "share")
}

function getOpenCodeBundledRg(): string | null {
  const execPath = process.execPath
  const execDir = dirname(execPath)

  const isWindows = process.platform === "win32"
  const rgName = isWindows ? "rg.exe" : "rg"

  const candidates = [
    // OpenCode XDG data path (highest priority — where OpenCode installs rg)
    join(getXdgDataDir(), "opencode", "bin", rgName),
    // Legacy paths relative to execPath
    join(execDir, rgName),
    join(execDir, "bin", rgName),
    join(execDir, "..", "bin", rgName),
    join(execDir, "..", "libexec", rgName),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

export function resolveGrepCli(): ResolvedCli {
  if (cachedCli) return cachedCli

  const bundledRg = getOpenCodeBundledRg()
  if (bundledRg) {
    cachedCli = { path: bundledRg, backend: "rg" }
    return cachedCli
  }

  const systemRg = findExecutable("rg")
  if (systemRg) {
    cachedCli = { path: systemRg, backend: "rg" }
    return cachedCli
  }

  const installedRg = getInstalledRipgrepPath()
  if (installedRg) {
    cachedCli = { path: installedRg, backend: "rg" }
    return cachedCli
  }

  const grep = findExecutable("grep")
  if (grep) {
    cachedCli = { path: grep, backend: "grep" }
    return cachedCli
  }

  cachedCli = { path: "rg", backend: "rg" }
  return cachedCli
}

export async function resolveGrepCliWithAutoInstall(): Promise<ResolvedCli> {
  const current = resolveGrepCli()

  if (current.backend === "rg" && current.path !== "rg") {
    return current
  }

  if (autoInstallAttempted) {
    return current
  }

  autoInstallAttempted = true

  try {
    const rgPath = await downloadAndInstallRipgrep()
    cachedCli = { path: rgPath, backend: "rg" }
    return cachedCli
  } catch (error) {
    if (current.backend === "grep") {
      log(`[${PLUGIN_NAME}] Failed to auto-install ripgrep. Falling back to GNU grep.`, {
        error: error instanceof Error ? error.message : String(error),
        grep_path: current.path,
      })
    } else {
      log(`[${PLUGIN_NAME}] Failed to auto-install ripgrep and GNU grep was not found.`, {
        error: error instanceof Error ? error.message : String(error),
      })
    }

    return current
  }
}

export const DEFAULT_MAX_DEPTH = 20
export const DEFAULT_MAX_FILESIZE = "10M"
export const DEFAULT_MAX_COUNT = 500
export const DEFAULT_MAX_COLUMNS = 1000
export const DEFAULT_CONTEXT = 2
export const DEFAULT_TIMEOUT_MS = 60_000
export const DEFAULT_MAX_OUTPUT_BYTES = 256 * 1024
export const DEFAULT_RG_THREADS = 4

export const RG_SAFETY_FLAGS = [
  "--no-follow",
  "--color=never",
  "--no-heading",
  "--line-number",
  "--with-filename",
] as const

export const GREP_SAFETY_FLAGS = ["-n", "-H", "--color=never"] as const
