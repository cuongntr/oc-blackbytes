/**
 * E2E scenario ocb-3r3.14.5: hashline_edit read + write + edit round-trip.
 *
 * Against a real temp workspace:
 *  1. Create a file with known content.
 *  2. Simulate a read tool output and invoke tool.execute.after → verify LINE#ID format.
 *  3. Extract LINE#IDs from the transformed output.
 *  4. Call the hashline_edit tool's execute with a replace op using those LINE#IDs.
 *  5. Verify the file was changed correctly.
 *  6. Simulate another read and verify the change is stable.
 *
 * Also exercises the write tool output normalization (line-count summary).
 */
import { describe, expect, it } from "bun:test"
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { loadPlugin } from "../helpers/plugin-harness"
import { makeTmpDir, writeJsoncFixture } from "../helpers/tmp-dir"

// Match LINE#ID|content format
const LINE_HASH_PATTERN = /^(\d+)#([A-Z]{2})\|(.*)$/

function parseLineHashOutput(
  output: string,
): Array<{ lineNum: number; hash: string; content: string }> {
  return output
    .split("\n")
    .map((line) => LINE_HASH_PATTERN.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ lineNum: Number(m[1]), hash: m[2], content: m[3] }))
}

function makeReadOutput(lines: string[]): string {
  return lines.map((l, i) => `${i + 1}: ${l}`).join("\n")
}

describe("E2E 14.5: hashline_edit read + write + edit round-trip", () => {
  it("tool.execute.after transforms read output into LINE#ID format", async () => {
    const tmp = makeTmpDir("oc-bb-hashline-read-")
    writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
    const hooks = await loadPlugin({ configDir: tmp.path, directory: tmp.path, worktree: tmp.path })

    // Simulate read tool output with colon-prefix format
    const rawReadOutput = makeReadOutput(["hello", "world", "goodbye"])
    const output = { title: "read", output: rawReadOutput, metadata: {} }

    const afterFn = (hooks as Record<string, unknown>)["tool.execute.after"] as (
      input: Record<string, unknown>,
      output: Record<string, unknown>,
    ) => Promise<void>

    await afterFn({ tool: "read", sessionID: "s1", callID: "c1", args: {} }, output)

    await tmp.cleanup()

    const transformed = output.output as string
    const parsed = parseLineHashOutput(transformed)

    expect(parsed).toHaveLength(3)
    expect(parsed[0]?.lineNum).toBe(1)
    expect(parsed[0]?.content).toBe("hello")
    expect(parsed[0]?.hash).toMatch(/^[A-Z]{2}$/)
    expect(parsed[1]?.lineNum).toBe(2)
    expect(parsed[1]?.content).toBe("world")
    expect(parsed[2]?.lineNum).toBe(3)
    expect(parsed[2]?.content).toBe("goodbye")
  })

  it("full round-trip: read → get LINE#IDs → hashline_edit replace → verify file change", async () => {
    const tmp = makeTmpDir("oc-bb-hashline-rt-")
    writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
    const hooks = await loadPlugin({ configDir: tmp.path, directory: tmp.path, worktree: tmp.path })

    // 1. Create a real temp file
    const filePath = path.join(tmp.path, "test-file.ts")
    writeFileSync(filePath, "const x = 1\nconst y = 2\nconst z = 3\n", "utf-8")

    // 2. Simulate read tool output → transform via tool.execute.after
    const rawReadOutput = makeReadOutput(["const x = 1", "const y = 2", "const z = 3"])
    const readOutput = { title: "read", output: rawReadOutput, metadata: { filePath } }

    const afterFn = (hooks as Record<string, unknown>)["tool.execute.after"] as (
      input: Record<string, unknown>,
      output: Record<string, unknown>,
    ) => Promise<void>

    await afterFn({ tool: "read", sessionID: "s1", callID: "c1", args: { filePath } }, readOutput)

    const transformed = readOutput.output as string
    const parsed = parseLineHashOutput(transformed)
    expect(parsed).toHaveLength(3)

    // 3. Build the LINE#ID anchor for line 2 (const y = 2)
    const line2 = parsed[1]
    expect(line2).toBeDefined()
    const anchor = `${line2?.lineNum}#${line2?.hash}`

    // 4. Call hashline_edit.execute with a replace op
    const registry = hooks.tool as Record<
      string,
      { execute: (args: unknown, ctx: unknown) => Promise<unknown> }
    >
    const hashlineEdit = registry.hashline_edit
    expect(hashlineEdit).toBeDefined()

    const editResult = await hashlineEdit.execute(
      {
        filePath,
        edits: [{ op: "replace", pos: anchor, lines: ["const y = 99"] }],
      },
      { directory: tmp.path },
    )

    // 5. Verify the result
    expect(typeof editResult).toBe("string")
    expect(editResult as string).not.toMatch(/^Error:/)

    // 6. Read the file and assert the change
    const after = readFileSync(filePath, "utf-8")
    expect(after).toContain("const y = 99")
    expect(after).toContain("const x = 1")
    expect(after).toContain("const z = 3")
    expect(after).not.toContain("const y = 2")

    await tmp.cleanup()
  })

  it("hashline_edit anchors are stable across reads of unchanged portions", async () => {
    const tmp = makeTmpDir("oc-bb-hashline-stable-")
    writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
    const hooks = await loadPlugin({ configDir: tmp.path, directory: tmp.path, worktree: tmp.path })

    const filePath = path.join(tmp.path, "stable.ts")
    writeFileSync(filePath, "line one\nline two\nline three\n", "utf-8")

    const afterFn = (hooks as Record<string, unknown>)["tool.execute.after"] as (
      input: Record<string, unknown>,
      output: Record<string, unknown>,
    ) => Promise<void>

    // First read
    const out1 = {
      title: "read",
      output: makeReadOutput(["line one", "line two", "line three"]),
      metadata: {},
    }
    await afterFn({ tool: "read", sessionID: "s1", callID: "c1", args: {} }, out1)
    const parsed1 = parseLineHashOutput(out1.output as string)

    // Second read (same content)
    const out2 = {
      title: "read",
      output: makeReadOutput(["line one", "line two", "line three"]),
      metadata: {},
    }
    await afterFn({ tool: "read", sessionID: "s2", callID: "c2", args: {} }, out2)
    const parsed2 = parseLineHashOutput(out2.output as string)

    await tmp.cleanup()

    // Line 1 and 3 anchors should be identical across reads
    expect(parsed1[0]?.hash).toBe(parsed2[0]?.hash)
    expect(parsed1[1]?.hash).toBe(parsed2[1]?.hash)
    expect(parsed1[2]?.hash).toBe(parsed2[2]?.hash)
  })

  it("write tool output is normalized to a line-count summary", async () => {
    const tmp = makeTmpDir("oc-bb-hashline-write-")
    writeJsoncFixture(`${tmp.path}/oc-blackbytes.jsonc`, {})
    const hooks = await loadPlugin({ configDir: tmp.path, directory: tmp.path, worktree: tmp.path })

    // Create a real file so the write normalization can count lines
    const filePath = path.join(tmp.path, "written.ts")
    writeFileSync(filePath, "line 1\nline 2\nline 3\n", "utf-8")

    const afterFn = (hooks as Record<string, unknown>)["tool.execute.after"] as (
      input: Record<string, unknown>,
      output: Record<string, unknown>,
    ) => Promise<void>

    // Simulate write tool output (non-success-marker triggers normalization)
    const writeOutput = {
      title: "write",
      output: `Wrote ${filePath}`,
      metadata: { filePath },
    }

    await afterFn({ tool: "write", sessionID: "s1", callID: "c1", args: { filePath } }, writeOutput)

    await tmp.cleanup()

    // The output should now contain a line-count summary
    const out = writeOutput.output as string
    expect(out).toContain("File written successfully.")
    expect(out).toContain("3 lines written")
  })
})
