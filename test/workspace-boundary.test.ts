import { afterEach, describe, expect, it } from "bun:test"
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { assertWithinWorkspace } from "../src/shared/utils"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "oc-bb-ws-")))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe("assertWithinWorkspace", () => {
  it("throws for path traversal outside workspace", async () => {
    const root = createTempDir()
    const traversal = path.join(root, "../../etc/passwd")
    await expect(assertWithinWorkspace(traversal, root)).rejects.toThrow()
  })

  it("throws for absolute path outside workspace", async () => {
    const root = createTempDir()
    await expect(assertWithinWorkspace("/etc/passwd", root)).rejects.toThrow()
  })

  it("does NOT throw when path equals workspace root", async () => {
    const root = createTempDir()
    await expect(assertWithinWorkspace(root, root)).resolves.toBeUndefined()
  })

  it("does NOT throw for valid path within workspace", async () => {
    const root = createTempDir()
    const file = path.join(root, "file.txt")
    writeFileSync(file, "hello")
    await expect(assertWithinWorkspace(file, root)).resolves.toBeUndefined()
  })

  it("does NOT throw for non-existent file with valid parent dir inside workspace", async () => {
    const root = createTempDir()
    const nonExistent = path.join(root, "does-not-exist.txt")
    await expect(assertWithinWorkspace(nonExistent, root)).resolves.toBeUndefined()
  })

  it("does NOT throw for non-existent parent dir inside workspace (lexical fallback)", async () => {
    const root = createTempDir()
    const deepNonExistent = path.join(root, "ghost-dir", "ghost-file.txt")
    await expect(assertWithinWorkspace(deepNonExistent, root)).resolves.toBeUndefined()
  })

  it("handles path with trailing slashes correctly — does NOT throw for root with slash", async () => {
    const root = createTempDir()
    const rootWithSlash = `${root}/`
    await expect(assertWithinWorkspace(rootWithSlash, root)).resolves.toBeUndefined()
  })

  it("handles path with trailing slashes correctly — does NOT throw for nested path with slash", async () => {
    const root = createTempDir()
    const subdir = path.join(root, "subdir")
    mkdirSync(subdir)
    await expect(assertWithinWorkspace(`${subdir}/`, root)).resolves.toBeUndefined()
  })

  it("throws for symlink pointing outside workspace", async () => {
    const root = createTempDir()
    const outside = createTempDir()
    const outsideFile = path.join(outside, "secret.txt")
    writeFileSync(outsideFile, "secret")

    const symlink = path.join(root, "evil-link")
    symlinkSync(outsideFile, symlink)

    await expect(assertWithinWorkspace(symlink, root)).rejects.toThrow()
  })
})
