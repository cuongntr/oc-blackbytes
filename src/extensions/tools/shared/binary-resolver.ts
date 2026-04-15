import { existsSync } from "node:fs"
import { join } from "node:path"
import { homedir, tmpdir } from "node:os"
import { CACHE_DIR_NAME } from "../../../shared/constants/plugin-identity"

export type BinaryBackend = "native" | "fallback"

export interface ResolvedBinary {
  path: string
  backend: BinaryBackend
}

/**
 * Gets the cache directory for storing downloaded binaries.
 */
export function getCacheDir(): string {
  const home = homedir()
  const platform = process.platform

  if (platform === "darwin") {
    return join(home, "Library", "Caches", CACHE_DIR_NAME)
  }
  if (platform === "win32") {
    return join(process.env.LOCALAPPDATA || join(home, "AppData", "Local"), CACHE_DIR_NAME)
  }
  return join(process.env.XDG_CACHE_HOME || join(home, ".cache"), CACHE_DIR_NAME)
}

/**
 * Resolves a CLI binary by checking: PATH → cache dir → null.
 */
export function resolveBinary(name: string, cachedBinaryName?: string): ResolvedBinary | null {
  // Check if available in PATH via `which`
  try {
    const result = Bun.spawnSync(["which", name], { stdout: "pipe", stderr: "pipe" })
    if (result.exitCode === 0) {
      const path = result.stdout.toString().trim()
      if (path && existsSync(path)) {
        return { path, backend: "native" }
      }
    }
  } catch {}

  // Check cache directory
  const binaryName = cachedBinaryName ?? name
  const cachePath = join(getCacheDir(), "bin", binaryName)
  if (existsSync(cachePath)) {
    return { path: cachePath, backend: "native" }
  }

  return null
}

/**
 * Gets the download target directory for binaries.
 */
export function getBinaryDownloadDir(): string {
  return join(getCacheDir(), "bin")
}
