import { afterEach, describe, expect, it } from "bun:test"
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { assertWithinWorkspace } from "../../src/shared/utils"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), "oc-bb-ws2-")))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

describe("assertWithinWorkspace — edge cases", () => {
  it("throws for path traversal via ..", async () => {
    const root = createTempDir()
    await expect(assertWithinWorkspace(path.join(root, "../../etc/passwd"), root)).rejects.toThrow()
  })

  it("throws for absolute path outside workspace", async () => {
    const root = createTempDir()
    await expect(assertWithinWorkspace("/etc/passwd", root)).rejects.toThrow()
  })

  it("does NOT throw for path equal to workspace root", async () => {
    const root = createTempDir()
    await expect(assertWithinWorkspace(root, root)).resolves.toBeUndefined()
  })

  it("does NOT throw for existing file inside workspace", async () => {
    const root = createTempDir()
    const file = path.join(root, "file.txt")
    writeFileSync(file, "content")
    await expect(assertWithinWorkspace(file, root)).resolves.toBeUndefined()
  })

  it("does NOT throw for non-existent file with valid parent dir inside workspace", async () => {
    const root = createTempDir()
    const nonExistent = path.join(root, "does-not-exist.txt")
    await expect(assertWithinWorkspace(nonExistent, root)).resolves.toBeUndefined()
  })

  it("does NOT throw for deeply nested non-existent path inside workspace", async () => {
    const root = createTempDir()
    const deep = path.join(root, "a", "b", "c", "deep.txt")
    await expect(assertWithinWorkspace(deep, root)).resolves.toBeUndefined()
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

  it("does NOT throw for path with trailing slash equal to root", async () => {
    const root = createTempDir()
    await expect(assertWithinWorkspace(`${root}/`, root)).resolves.toBeUndefined()
  })

  it("does NOT throw for nested dir with trailing slash", async () => {
    const root = createTempDir()
    const subdir = path.join(root, "sub")
    mkdirSync(subdir)
    await expect(assertWithinWorkspace(`${subdir}/`, root)).resolves.toBeUndefined()
  })

  it("throws for path traversal that normalizes to outside", async () => {
    const root = createTempDir()
    // A deeply nested traversal that still escapes
    const traversal = path.join(root, "a", "..", "..", "..", "etc", "passwd")
    await expect(assertWithinWorkspace(traversal, root)).rejects.toThrow()
  })

  it("error message includes the original path and workspace root", async () => {
    const root = createTempDir()
    const outside = "/etc/passwd"
    await expect(assertWithinWorkspace(outside, root)).rejects.toThrow(root)
  })
})
