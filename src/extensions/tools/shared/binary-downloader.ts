import { chmodSync, existsSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { log } from "../../../shared/utils/logger"
import { getBinaryDownloadDir } from "./binary-resolver"

/**
 * Downloads a binary from a URL and places it in the cache bin directory.
 * Returns the path to the downloaded binary.
 */
export async function downloadBinary(url: string, binaryName: string): Promise<string> {
  const binDir = getBinaryDownloadDir()
  const targetPath = join(binDir, binaryName)

  if (existsSync(targetPath)) {
    return targetPath
  }

  mkdirSync(binDir, { recursive: true })

  log(`Downloading ${binaryName} from ${url}...`)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${binaryName}: ${response.status} ${response.statusText}`)
  }

  const tempPath = join(tmpdir(), `${binaryName}-download-${Date.now()}`)
  const arrayBuffer = await response.arrayBuffer()
  await Bun.write(tempPath, arrayBuffer)

  // Handle different archive formats
  if (url.endsWith(".tar.gz") || url.endsWith(".tgz")) {
    await extractTarGz(tempPath, binDir, binaryName)
  } else if (url.endsWith(".zip")) {
    await extractZip(tempPath, binDir, binaryName)
  } else {
    // Direct binary download
    await Bun.write(targetPath, Bun.file(tempPath))
  }

  // Clean up temp file
  try {
    await Bun.file(tempPath).delete()
  } catch {}

  // Make executable
  if (process.platform !== "win32" && existsSync(targetPath)) {
    chmodSync(targetPath, 0o755)
  }

  log(`Downloaded ${binaryName} to ${targetPath}`)
  return targetPath
}

async function extractTarGz(
  archivePath: string,
  outputDir: string,
  _binaryName: string,
): Promise<void> {
  const result = Bun.spawnSync(
    ["tar", "xzf", archivePath, "--strip-components=1", "-C", outputDir],
    { stdout: "pipe", stderr: "pipe" },
  )

  if (result.exitCode !== 0) {
    // Try without --strip-components
    const fallback = Bun.spawnSync(["tar", "xzf", archivePath, "-C", outputDir], {
      stdout: "pipe",
      stderr: "pipe",
    })
    if (fallback.exitCode !== 0) {
      throw new Error(`Failed to extract tar.gz: ${fallback.stderr.toString()}`)
    }
  }
}

async function extractZip(
  archivePath: string,
  outputDir: string,
  _binaryName: string,
): Promise<void> {
  const result = Bun.spawnSync(["unzip", "-o", archivePath, "-d", outputDir], {
    stdout: "pipe",
    stderr: "pipe",
  })

  if (result.exitCode !== 0) {
    throw new Error(`Failed to extract zip: ${result.stderr.toString()}`)
  }
}
