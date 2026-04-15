import { existsSync } from "node:fs"
import { join } from "node:path"
import { downloadBinary } from "../shared/binary-downloader"
import { getBinaryDownloadDir } from "../shared/binary-resolver"

const RG_VERSION = "14.1.1"

const PLATFORM_CONFIG: Record<
  string,
  { platform: string; extension: "tar.gz" | "zip" } | undefined
> = {
  "arm64-darwin": { platform: "aarch64-apple-darwin", extension: "tar.gz" },
  "arm64-linux": { platform: "aarch64-unknown-linux-gnu", extension: "tar.gz" },
  "x64-darwin": { platform: "x86_64-apple-darwin", extension: "tar.gz" },
  "x64-linux": { platform: "x86_64-unknown-linux-musl", extension: "tar.gz" },
  "x64-win32": { platform: "x86_64-pc-windows-msvc", extension: "zip" },
}

function getBinaryName(): string {
  return process.platform === "win32" ? "rg.exe" : "rg"
}

export function getInstalledRipgrepPath(): string | null {
  const binDir = getBinaryDownloadDir()
  const binaryPath = join(binDir, getBinaryName())
  return existsSync(binaryPath) ? binaryPath : null
}

export async function downloadAndInstallRipgrep(): Promise<string> {
  const platformKey = `${process.arch}-${process.platform}`
  const config = PLATFORM_CONFIG[platformKey]

  if (!config) {
    throw new Error(`Unsupported platform for ripgrep: ${platformKey}`)
  }

  const binaryName = getBinaryName()
  const cachedPath = getInstalledRipgrepPath()
  if (cachedPath) return cachedPath

  const filename = `ripgrep-${RG_VERSION}-${config.platform}.${config.extension}`
  const url = `https://github.com/BurntSushi/ripgrep/releases/download/${RG_VERSION}/${filename}`

  return await downloadBinary(url, binaryName)
}
