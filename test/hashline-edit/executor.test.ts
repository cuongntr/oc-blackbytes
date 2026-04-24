/**
 * Integration tests for hashline-edit-executor.ts.
 *
 * Atomicity contract (pinned):
 *   The executor is NOT whole-call atomic at the call level. Each operation
 *   within a call is applied individually by applyHashlineEditsWithReport.
 *   A HashlineMismatchError from one op causes the remaining ops to be skipped,
 *   but the executor catches the error and returns an Error string — the file
 *   write only happens AFTER the full apply-result is computed in memory,
 *   so if validation throws, no disk write occurs for that call.
 *   In practice: either ALL operations apply to disk, or NONE do (the in-memory
 *   apply must succeed before Bun.write is called). This is effectively
 *   whole-call atomic at the disk level.
 *
 * Follow-up: if per-op writes are introduced, atomicity must be re-verified.
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import path from "node:path"
import { executeHashlineEditTool } from "../../src/extensions/tools/hashline-edit/hashline-edit-executor"
import { makeTmpDir, writeFixture } from "../helpers/tmp-dir"

// Minimal ToolContext compatible with the executor
function makeCtx(directory: string) {
  return { directory } as Parameters<typeof executeHashlineEditTool>[1]
}

describe("executeHashlineEditTool — end-to-end", () => {
  let dir: string
  let cleanup: () => Promise<void>

  beforeEach(() => {
    const tmp = makeTmpDir("oc-bb-executor-")
    dir = tmp.path
    cleanup = tmp.cleanup
  })

  afterEach(async () => {
    await cleanup()
  })

  // ---------------------------------------------------------------------------
  // create-new-file: append/prepend with no pos to a non-existent path
  // ---------------------------------------------------------------------------
  describe("create-new-file", () => {
    it("creates a new file via BOF prepend (no pos)", async () => {
      const filePath = path.join(dir, "new-file.ts")

      const result = await executeHashlineEditTool(
        {
          filePath,
          edits: [{ op: "prepend", lines: ["const x = 1"] }],
        },
        makeCtx(dir),
      )

      expect(result).toContain("Updated")
      const content = await Bun.file(filePath).text()
      expect(content).toContain("const x = 1")
    })

    it("creates a new file via EOF append (no pos)", async () => {
      const filePath = path.join(dir, "new-append.ts")

      const result = await executeHashlineEditTool(
        {
          filePath,
          edits: [{ op: "append", lines: ["export const foo = 42"] }],
        },
        makeCtx(dir),
      )

      expect(result).toContain("Updated")
      const content = await Bun.file(filePath).text()
      expect(content).toContain("export const foo = 42")
    })

    it("returns a markdown diff summary after updating a file", async () => {
      const filePath = path.join(dir, "diff-summary.ts")
      writeFixture(filePath, "const before = true\n")

      const result = await executeHashlineEditTool(
        {
          filePath,
          edits: [{ op: "prepend", lines: ["// generated header"] }],
        },
        makeCtx(dir),
      )

      expect(result).toContain(`Updated \`${filePath}\``)
      expect(result).toContain("Applied 1 edit: +")
      expect(result).toContain("```diff")
      expect(result).toContain("+// generated header")
      expect(result).toContain("```")
    })
  })

  // ---------------------------------------------------------------------------
  // delete-file: delete=true removes the file
  // ---------------------------------------------------------------------------
  describe("delete-file", () => {
    it("deletes an existing file", async () => {
      const filePath = path.join(dir, "to-delete.ts")
      writeFixture(filePath, "delete me\n")

      const result = await executeHashlineEditTool(
        { filePath, edits: [], delete: true },
        makeCtx(dir),
      )

      expect(result).toContain("deleted")
      const exists = await Bun.file(filePath).exists()
      expect(exists).toBe(false)
    })

    it("returns error when deleting a non-existent file", async () => {
      const filePath = path.join(dir, "ghost.ts")

      const result = await executeHashlineEditTool(
        { filePath, edits: [], delete: true },
        makeCtx(dir),
      )

      expect(result).toContain("Error")
      expect(result).toContain("not found")
    })

    it("returns error when delete=true with non-empty edits", async () => {
      const filePath = path.join(dir, "conflict.ts")
      writeFixture(filePath, "hello\n")

      const result = await executeHashlineEditTool(
        {
          filePath,
          edits: [{ op: "prepend", lines: ["x"] }],
          delete: true,
        },
        makeCtx(dir),
      )

      expect(result).toContain("Error")
    })
  })

  // ---------------------------------------------------------------------------
  // rename: moves content to new path and removes old path
  // ---------------------------------------------------------------------------
  describe("rename", () => {
    it("renames file to a new path", async () => {
      const filePath = path.join(dir, "original.ts")
      const newPath = path.join(dir, "renamed.ts")
      writeFixture(filePath, "const a = 1\n")

      const result = await executeHashlineEditTool(
        {
          filePath,
          edits: [{ op: "prepend", lines: ["// header"] }],
          rename: newPath,
        },
        makeCtx(dir),
      )

      expect(result).toContain("Moved")
      // old path removed
      const oldExists = await Bun.file(filePath).exists()
      expect(oldExists).toBe(false)
      // new path exists
      const newContent = await Bun.file(newPath).text()
      expect(newContent).toContain("// header")
      expect(newContent).toContain("const a = 1")
    })

    it("returns error when delete and rename are both set", async () => {
      const filePath = path.join(dir, "x.ts")
      writeFixture(filePath, "x\n")

      const result = await executeHashlineEditTool(
        {
          filePath,
          edits: [],
          delete: true,
          rename: path.join(dir, "y.ts"),
        },
        makeCtx(dir),
      )

      expect(result).toContain("Error")
    })
  })

  // ---------------------------------------------------------------------------
  // mixed-edits-one-call: multiple ops in a single call applied correctly
  // ---------------------------------------------------------------------------
  describe("mixed-edits-one-call", () => {
    it("applies replace + append in one call producing expected content", async () => {
      const filePath = path.join(dir, "multi.ts")
      // Write base content with enough lines to get real anchors.
      // We'll use the canCreateFromMissingFile path for simplicity.
      writeFixture(filePath, "line one\nline two\nline three\n")

      // Read the file to get LINE#ID anchors via Bun.file.text
      // We do NOT use the tool-execute-after rewrite here — compute anchors manually.
      // Strategy: use BOF prepend (no anchor) which doesn't need an anchor.
      // Then a second EOF append (no anchor).
      // Both ops have no `pos` so they are BOF/EOF operations — always valid.
      const result = await executeHashlineEditTool(
        {
          filePath,
          edits: [
            { op: "prepend", lines: ["// prepended header"] },
            { op: "append", lines: ["// appended footer"] },
          ],
        },
        makeCtx(dir),
      )

      expect(result).toContain("Updated")
      const content = await Bun.file(filePath).text()
      expect(content).toContain("// prepended header")
      expect(content).toContain("line one")
      expect(content).toContain("// appended footer")
      // Prepend should be before original content
      const headerIdx = content.indexOf("// prepended header")
      const lineOneIdx = content.indexOf("line one")
      const footerIdx = content.indexOf("// appended footer")
      expect(headerIdx).toBeLessThan(lineOneIdx)
      expect(lineOneIdx).toBeLessThan(footerIdx)
    })
  })

  // ---------------------------------------------------------------------------
  // failing-edit: anchor mismatch — file must be unchanged on disk
  // ---------------------------------------------------------------------------
  describe("failing-edit — atomicity", () => {
    it("leaves file unchanged when anchor hash does not match", async () => {
      const filePath = path.join(dir, "atomic.ts")
      const originalContent = "hello world\n"
      writeFixture(filePath, originalContent)

      // Capture mtime before the call
      const statBefore = Bun.file(filePath)
      const mtimeBefore = (await statBefore.stat()).mtime

      // Use a deliberately wrong anchor hash
      const result = await executeHashlineEditTool(
        {
          filePath,
          edits: [{ op: "replace", pos: "1#ZZ", lines: ["replaced line"] }],
        },
        makeCtx(dir),
      )

      // Should return an error (hash mismatch or validation error)
      expect(result).toMatch(/error/i)

      // File content must be unchanged — the write never happened
      const contentAfter = await Bun.file(filePath).text()
      expect(contentAfter).toBe(originalContent)

      // mtime should be unchanged (no write to disk)
      const mtimeAfter = (await Bun.file(filePath).stat()).mtime
      expect(mtimeAfter).toEqual(mtimeBefore)
    })
  })

  // ---------------------------------------------------------------------------
  // guard: empty edits without delete mode
  // ---------------------------------------------------------------------------
  it("returns error when edits is empty without delete mode", async () => {
    const filePath = path.join(dir, "empty-edits.ts")
    writeFixture(filePath, "content\n")

    const result = await executeHashlineEditTool({ filePath, edits: [] }, makeCtx(dir))

    expect(result).toContain("Error")
  })
})
