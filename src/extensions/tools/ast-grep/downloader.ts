import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
import { log } from "../../../shared/utils/logger"
import { downloadBinary } from "../shared/binary-downloader"
import { getBinaryDownloadDir } from "../shared/binary-resolver"

const REPO = "ast-grep/ast-grep"
const DEFAULT_VERSION = "0.41.1"

function getAstGrepVersion(): string {
  try {
    const require = createRequire(import.meta.url)
    const pkg = require("@ast-grep/cli/package.json")
    return pkg.version
  } catch {
    return DEFAULT_VERSION
  }
}

interface PlatformInfo {
  arch: string
  os: string
}

const PLATFORM_MAP: Record<string, PlatformInfo> = {
  "darwin-arm64": { arch: "aarch64", os: "apple-darwin" },
  "darwin-x64": { arch: "x86_64", os: "apple-darwin" },
  "linux-arm64": { arch: "aarch64", os: "unknown-linux-gnu" },
  "linux-x64": { arch: "x86_64", os: "unknown-linux-gnu" },
  "win32-x64": { arch: "x86_64", os: "pc-windows-msvc" },
  "win32-arm64": { arch: "aarch64", os: "pc-windows-msvc" },
  "win32-ia32": { arch: "i686", os: "pc-windows-msvc" },
}

export function getBinaryName(): string {
  return process.platform === "win32" ? "sg.exe" : "sg"
}

export function getCachedBinaryPath(): string | null {
  const binDir = getBinaryDownloadDir()
  const binaryPath = join(binDir, getBinaryName())
  return existsSync(binaryPath) ? binaryPath : null
}

export async function downloadAstGrep(version: string = DEFAULT_VERSION): Promise<string | null> {
  const platformKey = `${process.platform}-${process.arch}`
  const platformInfo = PLATFORM_MAP[platformKey]

  if (!platformInfo) {
    log(`Unsupported platform for ast-grep: ${platformKey}`)
    return null
  }

  const binaryName = getBinaryName()
  const cachedPath = getCachedBinaryPath()
  if (cachedPath) return cachedPath

  const { arch, os } = platformInfo
  const assetName = `app-${arch}-${os}.zip`
  const downloadUrl = `https://github.com/${REPO}/releases/download/${version}/${assetName}`

  try {
    return await downloadBinary(downloadUrl, binaryName)
  } catch (err) {
    log(`Failed to download ast-grep: ${err instanceof Error ? err.message : err}`)
    return null
  }
}

export async function ensureAstGrepBinary(): Promise<string | null> {
  const cachedPath = getCachedBinaryPath()
  if (cachedPath) return cachedPath

  const version = getAstGrepVersion()
  return downloadAstGrep(version)
}
