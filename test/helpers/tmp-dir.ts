import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

export function makeTmpDir(prefix = "oc-bb-"): { path: string; cleanup: () => Promise<void> } {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), prefix)))
  let cleaned = false

  const cleanup = async (): Promise<void> => {
    if (cleaned) return
    cleaned = true
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // best-effort, never throw
    }
  }

  return { path: dir, cleanup }
}

export function writeFixture(filePath: string, content: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, content, "utf-8")
}

export function writeJsoncFixture(filePath: string, value: unknown): void {
  const content = typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`
  writeFixture(filePath, content)
}

export function buildTree(rootPath: string, tree: Record<string, string>): void {
  for (const [relPath, content] of Object.entries(tree)) {
    const filePath = path.join(rootPath, relPath)
    writeFixture(filePath, content)
  }
}
