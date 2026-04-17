import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import path from "node:path"
import { loadPlugin } from "../helpers/plugin-harness"
import { makeTmpDir, writeFixture, writeJsoncFixture } from "../helpers/tmp-dir"

type ToolExecuteAfterHook = (
  input: { tool: string; sessionID: string; callID: string; args: unknown },
  output: { title: string; output: string; metadata: unknown },
) => Promise<void>

// Simulates what OpenCode's read tool produces for a text file
function makeReadOutput(lines: string[]): string {
  return lines.map((content, i) => `${i + 1}: ${content}`).join("\n")
}

// Wraps in OpenCode's <content>...</content> envelope
function makeContentOutput(lines: string[], prefix = ""): string {
  const inner = lines.map((content, i) => `${i + 1}: ${content}`).join("\n")
  return `${prefix}<content>\n${inner}\n</content>`
}

describe("handlers/tool-execute-after-handler (read path)", () => {
  let dir: string
  let cleanup: () => Promise<void>
  let hook: ToolExecuteAfterHook

  beforeEach(async () => {
    const tmp = makeTmpDir("oc-bb-tea-")
    dir = tmp.path
    cleanup = tmp.cleanup
    writeJsoncFixture(path.join(dir, "oc-blackbytes.json"), {})
    const hooks = await loadPlugin({ configDir: dir, directory: dir, worktree: dir })
    hook = hooks["tool.execute.after"] as ToolExecuteAfterHook
  })

  afterEach(async () => {
    await cleanup()
  })

  // -------------------------------------------------------------------------
  // Read path: LINE#ID transformation
  // -------------------------------------------------------------------------

  it("transforms read output lines into LINE#ID|content format", async () => {
    const rawOutput = makeReadOutput(["hello world", "second line"])
    const output = { title: "read", output: rawOutput, metadata: {} }
    await hook({ tool: "read", sessionID: "s1", callID: "c1", args: {} }, output)

    const resultLines = output.output.split("\n")
    // Each line should match the LINE#ID| pattern
    for (const line of resultLines) {
      expect(line).toMatch(/^\d+#[A-Z]{2}\|/)
    }
    // Content after the pipe should be preserved
    expect(output.output).toContain("|hello world")
    expect(output.output).toContain("|second line")
  })

  it("handles read output wrapped in <content> tags", async () => {
    const rawOutput = makeContentOutput(["foo", "bar"], "")
    const output = { title: "read", output: rawOutput, metadata: {} }
    await hook({ tool: "read", sessionID: "s1", callID: "c1", args: {} }, output)

    // The content lines should be transformed
    expect(output.output).toContain("|foo")
    expect(output.output).toContain("|bar")
    // The <content> wrapper should be preserved
    expect(output.output).toContain("<content>")
    expect(output.output).toContain("</content>")
  })

  it("does NOT transform non-text (binary-like) read output", async () => {
    // Binary output: first line doesn't match "N: content" format
    const binaryOutput = "PNG\x89\x50\x4e\x47 binary data here"
    const output = { title: "read", output: binaryOutput, metadata: {} }
    await hook({ tool: "read", sessionID: "s1", callID: "c1", args: {} }, output)
    // Should pass through unchanged
    expect(output.output).toBe(binaryOutput)
  })

  it("passes through image/attachment read output (no <content> line numbers)", async () => {
    // A directory listing has no line numbers — treated as non-text
    const dirOutput = "src/\ntest/\npackage.json"
    const output = { title: "read", output: dirOutput, metadata: {} }
    await hook({ tool: "read", sessionID: "s1", callID: "c1", args: {} }, output)
    // No transformation — first line doesn't match numbered pattern
    expect(output.output).toBe(dirOutput)
  })

  it("skips transformation when hashline_edit is disabled", async () => {
    const tmp2 = makeTmpDir("oc-bb-tea-disabled-")
    try {
      writeJsoncFixture(path.join(tmp2.path, "oc-blackbytes.json"), { hashline_edit: false })
      const hooks2 = await loadPlugin({
        configDir: tmp2.path,
        directory: tmp2.path,
        worktree: tmp2.path,
      })
      const hook2 = hooks2["tool.execute.after"] as ToolExecuteAfterHook
      const rawOutput = makeReadOutput(["hello", "world"])
      const output = { title: "read", output: rawOutput, metadata: {} }
      await hook2({ tool: "read", sessionID: "s1", callID: "c1", args: {} }, output)
      // No transformation — should be original
      expect(output.output).toBe(rawOutput)
    } finally {
      await tmp2.cleanup()
    }
  })

  it("is case-insensitive for tool name (Read vs read)", async () => {
    const rawOutput = makeReadOutput(["case test"])
    const output = { title: "Read", output: rawOutput, metadata: {} }
    await hook({ tool: "Read", sessionID: "s1", callID: "c1", args: {} }, output)
    expect(output.output).toContain("|case test")
  })

  // -------------------------------------------------------------------------
  // Write path: line-count summary (extending existing handlers.test.ts coverage)
  // -------------------------------------------------------------------------

  it("replaces write output with line-count summary using real file", async () => {
    const filePath = path.join(dir, "testfile.txt")
    writeFixture(filePath, "line1\nline2\nline3\n")
    const output = {
      title: "write",
      output: "some write output",
      metadata: { filePath },
    }
    await hook({ tool: "write", sessionID: "s2", callID: "c2", args: {} }, output)
    expect(output.output).toBe("File written successfully. 3 lines written.")
  })

  it("skips write summary when output already starts with success marker", async () => {
    const filePath = path.join(dir, "already.txt")
    writeFixture(filePath, "x\n")
    const output = {
      title: "write",
      output: "File written successfully.",
      metadata: { filePath },
    }
    await hook({ tool: "write", sessionID: "s2", callID: "c2", args: {} }, output)
    // Already starts with marker — no change
    expect(output.output).toBe("File written successfully.")
  })

  it("does not modify non-read non-write tool output", async () => {
    const original = "some grep output"
    const output = { title: "grep", output: original, metadata: {} }
    await hook({ tool: "grep", sessionID: "s3", callID: "c3", args: {} }, output)
    expect(output.output).toBe(original)
  })

  it("handles empty read output without throwing", async () => {
    const output = { title: "read", output: "", metadata: {} }
    await hook({ tool: "read", sessionID: "s4", callID: "c4", args: {} }, output)
    // Empty string passes through — no error
    expect(output.output).toBe("")
  })

  it("does not transform lines with truncation suffix (preserves originals)", async () => {
    const truncated = `1: short line\n2: ${"x".repeat(2000)}... (line truncated to 2000 chars)`
    const output = { title: "read", output: truncated, metadata: {} }
    await hook({ tool: "read", sessionID: "s5", callID: "c5", args: {} }, output)
    // Line 1 should be transformed, line 2 (truncated) preserved as-is
    const resultLines = output.output.split("\n")
    expect(resultLines[0]).toMatch(/^1#[A-Z]{2}\|short line$/)
    // Truncated line is not rewritten
    expect(resultLines[1]).toMatch(/^\d+: /)
  })
})
